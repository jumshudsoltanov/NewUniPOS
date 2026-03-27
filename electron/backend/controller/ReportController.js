const { Op, fn, col } = require("sequelize");
const OrdersModel = require("../model/OrdersModel");
const OrdersItemsModel = require("../model/OrdersItemsModel");
const ProductsModel = require("../model/ProductsModel");
const CategoriesModel = require("../model/CategoriesModel");
const WaitersModel = require("../model/WaitersModel");
const OrderPaymentsModel = require("../model/OrderPaymentsModel");
const PaymentMethodsModel = require("../model/PaymentMethodsModel");
const TablesModel = require("../model/TablesModel");
const TableGroupsModel = require("../model/TableGroupsModel");
const LoginModel = require("../model/LoginModel");

const getReportData = async (req, res) => {
    const { profileId } = req.params;
    const { startDate, startTime, endDate, endTime, terminal, reportType, showTransactions } = req.query;

    try {
        // Use strings for SQLite compatibility if needed, but Date objects are usually fine if handled correctly.
        // Ensure we are working with the correct date range.
        const startStr = `${startDate} ${startTime}:00`;
        const endStr = `${endDate} ${endTime}:00`;
        // Date obyektlərini istifadə et — Sequelize timezone-a görə düzgün çevirir
        const startDateObj = new Date(startStr);
        const endDateObj = new Date(endStr);

        console.log(`Generating report from ${startStr} to ${endStr}`);

        let baseWhere = {
            profile_id: profileId
        };

        if (terminal && terminal !== "all") {
            baseWhere.terminal_id = terminal;
        }

        // For most reports (closed orders), we should filter by end_date
        let closedWhere = {
            ...baseWhere,
            status: 2,
            end_date: {
                [Op.between]: [startDateObj, endDateObj],
            },
        };

        let data = [];

        switch (reportType) {
            case "simple":
                data = await getSimpleReport(profileId, baseWhere, startDateObj, endDateObj, showTransactions === 'true');
                break;
            case "products":
                data = await getProductsReport(closedWhere);
                break;
            case "hall":
            case "department":
                data = await getHallReport(closedWhere);
                break;
            case "tables":
                data = await getTablesReport(closedWhere);
                break;
            case "checks":
                data = await getChecksReport(closedWhere, showTransactions === 'true');
                break;
            case "sale_method":
                data = await getSaleMethodReport(closedWhere);
                break;
            case "employee":
                data = await getEmployeeReport(closedWhere);
                break;
            case "category":
                data = await getCategoryReport(closedWhere);
                break;
            case "refunds":
                data = await getRefundsReport(baseWhere, startDateObj, endDateObj);
                break;
            case "gifted_products":
                data = await getGiftedProductsReport(closedWhere);
                break;
            case "financial":
                data = await getFinancialReport(baseWhere, startDateObj, endDateObj);
                break;
            case "inventory":
                data = [];
                break;
            case "customers":
                data = await getCustomersReport(closedWhere);
                break;
            default:
                data = [];
        }

        res.status(200).json({ status: "success", data });
    } catch (error) {
        console.error("Report Error:", error);
        res.status(500).json({ status: "error", message: error.message });
    }
};

const getSimpleReport = async (profileId, baseWhere, start, end, showTransactions) => {
    const profile = await LoginModel.findOne({ where: { id: profileId } });
    const taxPercent = parseFloat(profile?.tax_percent || 0);
    // 1. Fetch Closed Orders (sales)
    const closedOrders = await OrdersModel.findAll({
        where: {
            ...baseWhere,
            status: 2,
            end_date: { [Op.between]: [start, end] }
        },
        include: [
            {
                model: OrderPaymentsModel,
                as: 'order_payments',
                required: false,
                include: [
                    { model: PaymentMethodsModel, as: 'payment_method', required: false },
                    { model: require("../model/TagsModel"), as: 'tag', required: false }
                ]
            },
            {
                model: OrdersItemsModel,
                as: 'orders_items',
                include: [{ model: ProductsModel, as: 'product', required: false }]
            }
        ]
    });

    // 2. Fetch Returned Orders separately
    const returnedOrders = await OrdersModel.findAll({
        where: {
            ...baseWhere,
            status: 3,
            is_return: 1,
            updated_at: { [Op.between]: [start, end] }
        },
        include: [{ model: require("../model/TagsModel"), as: 'delete_reason' }],
        paranoid: false
    });

    // 3. Fetch Deleted Orders
    const deletedOrders = await OrdersModel.findAll({
        where: {
            ...baseWhere,
            status: 3,
            is_delete_reason_id: { [Op.not]: null },
            [Op.or]: [{ is_return: null }, { is_return: 0 }],
            updated_at: { [Op.between]: [start, end] }
        },
        include: [{ model: require("../model/TagsModel"), as: 'delete_reason' }],
        paranoid: false
    });

    // 4. Fetch Deleted Items (Soft-deleted)
    const deletedItems = await OrdersItemsModel.findAll({
        where: {
            profile_id: profileId,
            deleted_at: { [Op.between]: [start, end] },
            is_delete_reason_id: { [Op.not]: null }
        },
        include: [{ model: require("../model/TagsModel"), as: 'delete_reason' }],
        paranoid: false // Include soft-deleted
    });

    // 5. Fetch Open Orders
    const openOrders = await OrdersModel.findAll({
        where: {
            ...baseWhere,
            status: 1,
            start_date: { [Op.between]: [start, end] }
        }
    });

    let summary = {
        total_amount: 0,
        total_discount: 0,
        total_service: 0,
        total_gift: 0,
        total_refund: 0,
        total_deleted: 0,
        total_tax: 0,
        net_total: 0,
        guest_count: 0,
        open_orders_count: 0,
        open_orders_total: 0,
        total_paid: 0,       // ödənişli bağlamaların cəmi
        total_unpaid: 0,     // ödənişsiz bağlamaların cəmi
        payments: {},        // normal ödənişlər (Nağd, Nağdsız bank kartı və s.)
        unpaid_payments: {}, // ödənişsiz bağlamalar (without_payment_method_id > 0)
        tags: {}
    };

    openOrders.forEach(order => {
        summary.open_orders_count += 1;
        summary.open_orders_total += parseFloat(order.total || 0);
    });

    // Process Closed Orders
    closedOrders.forEach(order => {
        // order.amount — bağlananda məhsul cəmi; timer məbləği rate_per_minute-da (onCloseOrder amount-a daxil edilmir)
        const itemsSub = parseFloat(order.amount || 0) || 0;
        const timerSub = parseFloat(order.rate_per_minute || 0) || 0;
        summary.total_amount += itemsSub + timerSub;
        summary.total_discount += parseFloat(order.discount || 0);
        summary.total_service += parseFloat(order.service_charge || 0);
        const orderTotal = parseFloat(order.total || 0);
        summary.net_total += orderTotal;
        summary.guest_count += parseInt(order.guest_count || 0);

        // Tax calculation: inclusive VAT = total * taxPercent / (100 + taxPercent)
        let isTaxFlag = parseFloat(order.is_tax || 0);
        if (isTaxFlag > 0) {
            let currentTaxPercent = isTaxFlag > 1 ? isTaxFlag : taxPercent;
            if (currentTaxPercent > 0) {
                summary.total_tax += orderTotal * currentTaxPercent / (100 + currentTaxPercent);
            }
        }

        // Calculate Gifts within these orders (is_gift: 1, "1", true)
        // İkram üçün qiymət 0 ola bilər — nominal dəyər: original_price, product.price və ya item.price
        if (order.orders_items) {
            order.orders_items.forEach(item => {
                const isGift = Number(item.is_gift) === 1 || item.is_gift === true;
                if (isGift) {
                    const itemCount = parseFloat(item.count || 0);
                    const itemPrice = parseFloat(item.price || 0);
                    const origPrice = parseFloat(item.original_price || 0);
                    const productPrice = parseFloat(item.product?.price || 0);
                    const nominalPrice = itemPrice > 0 ? itemPrice : (origPrice > 0 ? origPrice : productPrice);

                    let modifiersTotal = 0;
                    try {
                        const mods = Array.isArray(item.modifiers) ? item.modifiers : (typeof item.modifiers === 'string' ? JSON.parse(item.modifiers || '[]') : []);
                        modifiersTotal = mods.reduce((s, m) => s + (parseFloat(m.price || 0) * parseFloat(m.count || 1)), 0);
                    } catch (_) {}

                    summary.total_gift += itemCount * (nominalPrice + modifiersTotal);
                }
            });
        }

        // Payments summary — normal vs ödənişsiz ayrı
        if (order.order_payments) {
            order.order_payments.forEach(p => {
                const amount = parseFloat(p.paid || 0);
                if (p.without_payment_method_id && p.without_payment_method_id > 0) {
                    // Ödənişsiz bağlama — ayrı bölmə
                    const methodName = p.name || p.tag?.name || 'Ödənişsiz';
                    summary.unpaid_payments[methodName] = (summary.unpaid_payments[methodName] || 0) + amount;
                    summary.total_unpaid += amount;
                } else {
                    // Normal ödəniş
                    const methodName = p.name || p.payment_method?.name || 'Nağd';
                    summary.payments[methodName] = (summary.payments[methodName] || 0) + amount;
                    summary.total_paid += amount;
                }
            });
        }

        // Tags summary
        let orderTags = [];
        // 1. From order.tags field
        if (order.tags) {
            orderTags = orderTags.concat(order.tags.split(',').map(t => t.trim()).filter(t => t));
        }
        // 2. From order_payments tags (without_payment_method_id)
        if (order.order_payments) {
            order.order_payments.forEach(p => {
                if (p.tag && p.tag.name) {
                    orderTags.push(p.tag.name);
                }
            });
        }

        // Aggregate unique tags for this order
        const uniqueTags = [...new Set(orderTags)];
        uniqueTags.forEach(tagName => {
            if (!summary.tags[tagName]) {
                summary.tags[tagName] = { count: 0, total: 0 };
            }
            summary.tags[tagName].count += 1;
            summary.tags[tagName].total += parseFloat(order.total || 0);
        });
    });

    // Process Returned Orders for the refund line and tags
    returnedOrders.forEach(order => {
        const orderVal = parseFloat(order.total || order.amount || 0);
        summary.total_refund += orderVal;

        let orderTags = [];
        if (order.tags) {
            orderTags = orderTags.concat(order.tags.split(',').map(t => t.trim()).filter(t => t));
        }
        if (order.delete_reason && order.delete_reason.name) {
            orderTags.push(order.delete_reason.name);
        }

        const uniqueTags = [...new Set(orderTags)];
        uniqueTags.forEach(tagName => {
            if (!summary.tags[tagName]) {
                summary.tags[tagName] = { count: 0, total: 0 };
            }
            summary.tags[tagName].count += 1;
            summary.tags[tagName].total += orderVal;
        });
    });

    // Process Deleted Orders (manager permission) and tags
    deletedOrders.forEach(order => {
        const orderVal = parseFloat(order.total || order.amount || 0);
        summary.total_deleted += orderVal;

        let orderTags = [];
        if (order.tags) {
            orderTags = orderTags.concat(order.tags.split(',').map(t => t.trim()).filter(t => t));
        }
        if (order.delete_reason && order.delete_reason.name) {
            orderTags.push(order.delete_reason.name);
        }

        const uniqueTags = [...new Set(orderTags)];
        uniqueTags.forEach(tagName => {
            if (!summary.tags[tagName]) {
                summary.tags[tagName] = { count: 0, total: 0 };
            }
            summary.tags[tagName].count += 1;
            summary.tags[tagName].total += orderVal;
        });
    });

    // Process Deleted Items tags
    deletedItems.forEach(item => {
        if (item.delete_reason && item.delete_reason.name) {
            const tagName = item.delete_reason.name;
            if (!summary.tags[tagName]) {
                summary.tags[tagName] = { count: 0, total: 0 };
            }
            summary.tags[tagName].count += 1;
            summary.tags[tagName].total += (parseFloat(item.count || 0) * parseFloat(item.price || 0));
        }
    });

    return summary;
};

/** Sətir məbləği: say × (qiymət + modifierlər) — kateqoriya/məhsul cəmləri ilə uyğun */
const lineItemTotalForReport = (item) => {
    const qty = parseFloat(item.count || 0);
    const price = parseFloat(item.price || 0);
    let modifiersTotal = 0;
    try {
        let mods = item.modifiers;
        if (typeof mods === "string") mods = JSON.parse(mods || "[]");
        if (Array.isArray(mods)) {
            modifiersTotal = mods.reduce(
                (s, m) => s + parseFloat(m.price || 0) * parseFloat(m.count || 1),
                0
            );
        }
    } catch (_) { /* ignore */ }
    return qty * (price + modifiersTotal);
};

const getProductsReport = async (whereClause) => {
    const orders = await OrdersModel.findAll({
        where: whereClause,
        include: [{
            model: OrdersItemsModel,
            as: 'orders_items',
            include: [{ model: ProductsModel, as: 'product' }]
        }]
    });

    let productsMap = {};

    orders.forEach(order => {
        if (order.orders_items) {
            order.orders_items.forEach(item => {
                const productId = item.product_id;
                const isGift = Number(item.is_gift) === 1 || item.is_gift === true;
                const itemCount = parseFloat(item.count || 0);
                const itemPrice = parseFloat(item.price || 0);
                const nominalPrice = itemPrice > 0 ? itemPrice : parseFloat(item.original_price || 0);

                if (!productsMap[productId]) {
                    productsMap[productId] = {
                        name: item.product?.name || 'Naməlum',
                        quantity: 0,
                        quantity_gift: 0,
                        total: 0,
                        total_gift: 0
                    };
                }
                productsMap[productId].quantity += itemCount;
                if (isGift) {
                    productsMap[productId].quantity_gift += itemCount;
                    productsMap[productId].total_gift += itemCount * nominalPrice;
                } else {
                    productsMap[productId].total += lineItemTotalForReport(item);
                }
            });
        }
    });

    return Object.values(productsMap).map(p => ({
        name: p.name,
        quantity: p.quantity,
        quantity_gift: p.quantity_gift || 0,
        total: (p.total || 0) + (p.total_gift || 0),
        total_sold: p.total || 0,
        total_gift: p.total_gift || 0
    })).sort((a, b) => b.total - a.total);
};

const getEmployeeReport = async (whereClause) => {
    const orders = await OrdersModel.findAll({
        where: whereClause,
        include: [{ model: WaitersModel, as: 'waiter', attributes: ['name'] }]
    });

    let employeeMap = {};

    orders.forEach(order => {
        const waiterName = order.waiter?.name || 'Adsız';
        if (!employeeMap[waiterName]) {
            employeeMap[waiterName] = {
                name: waiterName,
                checks_count: 0,
                total: 0
            };
        }
        employeeMap[waiterName].checks_count += 1;
        employeeMap[waiterName].total += parseFloat(order.total || 0);
    });

    return Object.values(employeeMap).sort((a, b) => b.total - a.total);
};

const getCategoryReport = async (whereClause) => {
    const orders = await OrdersModel.findAll({
        where: whereClause,
        include: [{
            model: OrdersItemsModel,
            as: 'orders_items',
            include: [{
                model: ProductsModel,
                as: 'product',
                include: [{ model: CategoriesModel, as: 'category' }]
            }]
        }]
    });

    let categoryMap = {};

    orders.forEach(order => {
        if (order.orders_items) {
            order.orders_items.forEach(item => {
                const categoryName = item.product?.category?.name || 'Kategoriyasız';
                const productLabel = item.product?.name || item.name || 'Naməlum';
                const productKey = item.product_id || item.product?.id || productLabel;
                const lineTotal = lineItemTotalForReport(item);
                const qty = parseFloat(item.count || 0);

                if (!categoryMap[categoryName]) {
                    categoryMap[categoryName] = {
                        name: categoryName,
                        quantity: 0,
                        total: 0,
                        products: {}
                    };
                }
                const cat = categoryMap[categoryName];
                cat.quantity += qty;
                cat.total += lineTotal;

                if (!cat.products[productKey]) {
                    cat.products[productKey] = {
                        name: productLabel,
                        quantity: 0,
                        total: 0
                    };
                }
                cat.products[productKey].quantity += qty;
                cat.products[productKey].total += lineTotal;
            });
        }
    });

    return Object.values(categoryMap)
        .map((cat) => ({
            name: cat.name,
            quantity: cat.quantity,
            total: cat.total,
            products: Object.values(cat.products || {}).sort((a, b) => b.total - a.total)
        }))
        .sort((a, b) => b.total - a.total);
};

const getChecksReport = async (whereClause, showTransactions) => {
    const include = [
        { model: WaitersModel, as: 'waiter', attributes: ['name'] },
        { model: TablesModel, as: 'table', attributes: ['name'] }
    ];

    if (showTransactions) {
        include.push({
            model: OrderPaymentsModel,
            as: 'order_payments',
            required: false,
            include: [
                { model: PaymentMethodsModel, as: 'payment_method', required: false },
                { model: require("../model/TagsModel"), as: 'tag', required: false }
            ]
        });
    }

    const orders = await OrdersModel.findAll({
        where: whereClause,
        include: include,
        order: [['start_date', 'DESC']]
    });

    // Post-process to merge tags if needed
    return orders.map(order => {
        const orderJSON = order.toJSON();
        let tagsList = [];

        // Add order level tags
        if (orderJSON.tags) tagsList.push(orderJSON.tags);

        // Add payment level tags
        if (orderJSON.order_payments) {
            orderJSON.order_payments.forEach(p => {
                if (p.tag && p.tag.name) {
                    tagsList.push(p.tag.name);
                }
            });
        }

        // Deduplicate and join
        orderJSON.tags = [...new Set(tagsList)].join(', ');
        return orderJSON;
    });
};

const getHallReport = async (whereClause) => {
    const orders = await OrdersModel.findAll({
        where: whereClause,
        include: [{
            model: TablesModel,
            as: 'table',
            include: [{ model: TableGroupsModel, as: 'hall' }]
        }]
    });

    let hallMap = {};

    const saleTypeNames = {
        delivery: 'Çatdırılma',
        takeaway: 'Gəl götür',
        dine_in: 'Naməlum'
    };

    orders.forEach(order => {
        const hallName = order.table?.hall?.name || saleTypeNames[order.sale_type] || 'Naməlum';
        if (!hallMap[hallName]) {
            hallMap[hallName] = {
                name: hallName,
                checks_count: 0,
                total: 0
            };
        }
        hallMap[hallName].checks_count += 1;
        hallMap[hallName].total += parseFloat(order.total || 0);
    });

    return Object.values(hallMap).sort((a, b) => b.total - a.total);
};

const getTablesReport = async (whereClause) => {
    const orders = await OrdersModel.findAll({
        where: whereClause,
        include: [{ model: TablesModel, as: 'table' }]
    });

    let tableMap = {};

    orders.forEach(order => {
        const tableName = order.table?.name || 'Masasız';
        if (!tableMap[tableName]) {
            tableMap[tableName] = {
                name: tableName,
                checks_count: 0,
                total: 0,
                timer_total: 0
            };
        }
        tableMap[tableName].checks_count += 1;
        tableMap[tableName].total += parseFloat(order.total || 0);
        const timerCharge = parseFloat(order.rate_per_minute || 0);
        if (timerCharge > 0) {
            tableMap[tableName].timer_total += timerCharge;
        }
    });

    const rows = Object.values(tableMap).sort((a, b) => b.total - a.total);
    const totalTimer = rows.reduce((sum, r) => sum + (r.timer_total || 0), 0);
    return { rows, totalTimer };
};

const getSaleMethodReport = async (whereClause) => {
    const orders = await OrdersModel.findAll({
        where: whereClause
    });

    let methodMap = {
        'dine_in': { name: 'Zalda', count: 0, total: 0 },
        'takeaway': { name: 'Gəl götür', count: 0, total: 0 },
        'delivery': { name: 'Çatdırılma', count: 0, total: 0 }
    };

    orders.forEach(order => {
        const method = order.sale_type || 'dine_in';
        if (!methodMap[method]) {
            methodMap[method] = { name: method, count: 0, total: 0 };
        }
        methodMap[method].count += 1;
        methodMap[method].total += parseFloat(order.total || 0);
    });

    return Object.values(methodMap);
};

const getRefundsReport = async (baseWhere, start, end) => {
    const orders = await OrdersModel.findAll({
        where: {
            ...baseWhere,
            status: 3,
            is_return: 1,
            updated_at: { [Op.between]: [start, end] }
        },
        include: [
            { model: WaitersModel, as: 'waiter', attributes: ['name'] }
        ],
        order: [['updated_at', 'DESC']]
    });
    return orders.map(o => o.toJSON());
};

const getFinancialReport = async (baseWhere, start, end) => {
    const orders = await OrdersModel.findAll({
        where: {
            ...baseWhere,
            status: 2,
            end_date: { [Op.between]: [start, end] }
        },
        include: [{
            model: OrderPaymentsModel,
            as: 'order_payments',
            required: false,
            include: [
                { model: PaymentMethodsModel, as: 'payment_method', required: false },
                { model: require("../model/TagsModel"), as: 'tag', required: false }
            ]
        }]
    });

    let paymentMap = {};
    let total = 0;

    orders.forEach(order => {
        if (order.order_payments) {
            order.order_payments.forEach(p => {
                let name;
                if (p.without_payment_method_id && p.without_payment_method_id > 0) {
                    name = p.name || p.tag?.name || 'Ödənişsiz';
                } else {
                    name = p.name || p.payment_method?.name || 'Nağd';
                }
                const amount = parseFloat(p.paid || 0);
                if (!paymentMap[name]) {
                    paymentMap[name] = { name, count: 0, total: 0 };
                }
                paymentMap[name].count += 1;
                paymentMap[name].total += amount;
                total += amount;
            });
        }
    });

    return Object.values(paymentMap).sort((a, b) => b.total - a.total);
};

const getGiftedProductsReport = async (whereClause) => {
    const orders = await OrdersModel.findAll({
        where: whereClause,
        include: [{
            model: OrdersItemsModel,
            as: 'orders_items',
            where: { is_gift: 1 },
            include: [{ model: ProductsModel, as: 'product' }]
        }]
    });

    let gifts = [];
    orders.forEach(order => {
        if (order.orders_items) {
            order.orders_items.forEach(item => {
                gifts.push({
                    order_id: order.id,
                    product_name: item.product?.name || 'Naməlum',
                    quantity: item.count,
                    time: order.end_date
                });
            });
        }
    });

    return gifts;
};

const getCustomersReport = async (whereClause) => {
    const orders = await OrdersModel.findAll({
        where: whereClause
    });

    let customerMap = {};

    orders.forEach(order => {
        const cId = order.customer_id;
        if (cId) {
            if (!customerMap[cId]) {
                customerMap[cId] = {
                    customer_id: cId,
                    checks_count: 0,
                    total: 0
                };
            }
            customerMap[cId].checks_count += 1;
            customerMap[cId].total += parseFloat(order.total || 0);
        }
    });

    return Object.values(customerMap).sort((a, b) => b.total - a.total);
};

const getTerminals = async (req, res) => {
    const { profileId } = req.params;
    try {
        const terminals = await OrdersModel.findAll({
            where: { profile_id: profileId },
            attributes: [[fn('DISTINCT', col('terminal_id')), 'terminal_id']],
            raw: true
        });

        const list = terminals
            .filter(t => t.terminal_id)
            .map(t => {
                const cleanId = t.terminal_id.replace(/^[Mm]/, '');
                return { id: t.terminal_id, name: `Terminal ${cleanId}` };
            });

        res.status(200).json({ status: "success", data: list });
    } catch (error) {
        res.status(500).json({ status: "error", message: error.message });
    }
};

/**
 * Bağlanmış çeklər üzrə növbə/interval xülasəsi (ofisiant + satış üsulu).
 * @param {string|number} profileId
 * @param {string|null|undefined} terminalId — boş və ya "all" = bütün terminallar
 * @param {Date|string} startStr — Date obyekti və ya "YYYY-MM-DD HH:mm:ss"
 * @param {Date|string} endStr
 */
const getShiftSummaryForRange = async (profileId, terminalId, startStr, endStr) => {
    // Date obyekti gəlsə olduğu kimi işlət (Sequelize timezone-a görə düzgün çevirir)
    // String gəlsə Date-ə çevir
    const startVal = startStr instanceof Date ? startStr : new Date(startStr);
    const endVal = endStr instanceof Date ? endStr : new Date(endStr);
    const baseWhere = { profile_id: profileId };
    if (terminalId && String(terminalId) !== "all") {
        baseWhere.terminal_id = terminalId;
    }
    const closedWhere = {
        ...baseWhere,
        status: 2,
        end_date: { [Op.between]: [startVal, endVal] },
    };

    const profile = await LoginModel.findOne({ where: { id: profileId } });
    const taxPercent = parseFloat(profile?.tax_percent || 0);

    const [byEmployee, bySaleMethod, byCategory, checksCount, grossSum, closedOrders, returnedOrders, deletedOrders] = await Promise.all([
        getEmployeeReport(closedWhere),
        getSaleMethodReport(closedWhere),
        getCategoryReport(closedWhere),
        OrdersModel.count({ where: closedWhere }),
        OrdersModel.sum("total", { where: closedWhere }),
        OrdersModel.findAll({
            where: closedWhere,
            include: [
                {
                    model: OrderPaymentsModel,
                    as: 'order_payments',
                    required: false,
                    include: [
                        { model: PaymentMethodsModel, as: 'payment_method', required: false },
                        { model: require("../model/TagsModel"), as: 'tag', required: false }
                    ]
                },
                {
                    model: OrdersItemsModel,
                    as: 'orders_items',
                    required: false,
                    include: [{ model: ProductsModel, as: 'product', required: false }]
                }
            ]
        }),
        OrdersModel.findAll({
            where: { ...baseWhere, status: 3, is_return: 1, updated_at: { [Op.between]: [startVal, endVal] } },
            include: [{ model: require("../model/TagsModel"), as: 'delete_reason', required: false }],
            paranoid: false
        }),
        OrdersModel.findAll({
            where: { ...baseWhere, status: 3, is_delete_reason_id: { [Op.not]: null }, [Op.or]: [{ is_return: null }, { is_return: 0 }], updated_at: { [Op.between]: [startVal, endVal] } },
            include: [{ model: require("../model/TagsModel"), as: 'delete_reason', required: false }],
            paranoid: false
        }),
    ]);

    const payments = {};
    const unpaid_payments = {};
    const tags = {};
    let total_amount = 0, total_discount = 0, total_service = 0, total_gift = 0;
    let total_tax = 0, net_total = 0, guest_count = 0;
    let total_paid = 0, total_unpaid = 0;
    let delivery_fee = 0;

    closedOrders.forEach(order => {
        const itemsSub = parseFloat(order.amount || 0) || 0;
        const timerSub = parseFloat(order.rate_per_minute || 0) || 0;
        total_amount += itemsSub + timerSub;
        total_discount += parseFloat(order.discount || 0);
        total_service += parseFloat(order.service_charge || 0);
        delivery_fee += parseFloat(order.delivery_fee || 0);
        guest_count += parseInt(order.guest_count || 0);
        const orderTotal = parseFloat(order.total || 0);
        net_total += orderTotal;

        let isTaxFlag = parseFloat(order.is_tax || 0);
        if (isTaxFlag > 0) {
            let currentTaxPercent = isTaxFlag > 1 ? isTaxFlag : taxPercent;
            if (currentTaxPercent > 0) {
                total_tax += orderTotal * currentTaxPercent / (100 + currentTaxPercent);
            }
        }

        if (order.orders_items) {
            order.orders_items.forEach(item => {
                const isGift = Number(item.is_gift) === 1 || item.is_gift === true;
                if (isGift) {
                    const itemCount = parseFloat(item.count || 0);
                    const itemPrice = parseFloat(item.price || 0);
                    const origPrice = parseFloat(item.original_price || 0);
                    const productPrice = parseFloat(item.product?.price || 0);
                    const nominalPrice = itemPrice > 0 ? itemPrice : (origPrice > 0 ? origPrice : productPrice);
                    let modifiersTotal = 0;
                    try {
                        const mods = Array.isArray(item.modifiers) ? item.modifiers : (typeof item.modifiers === 'string' ? JSON.parse(item.modifiers || '[]') : []);
                        modifiersTotal = mods.reduce((s, m) => s + (parseFloat(m.price || 0) * parseFloat(m.count || 1)), 0);
                    } catch (_) {}
                    total_gift += itemCount * (nominalPrice + modifiersTotal);
                }
            });
        }

        if (order.order_payments) {
            order.order_payments.forEach(p => {
                const amount = parseFloat(p.paid || 0);
                if (p.without_payment_method_id && p.without_payment_method_id > 0) {
                    const name = p.name || p.tag?.name || 'Ödənişsiz';
                    unpaid_payments[name] = (unpaid_payments[name] || 0) + amount;
                    total_unpaid += amount;
                } else {
                    const name = p.name || p.payment_method?.name || 'Nağd';
                    payments[name] = (payments[name] || 0) + amount;
                    total_paid += amount;
                }
            });
        }

        let orderTags = [];
        if (order.tags) orderTags = order.tags.split(',').map(t => t.trim()).filter(t => t);
        if (order.order_payments) {
            order.order_payments.forEach(p => { if (p.tag?.name) orderTags.push(p.tag.name); });
        }
        [...new Set(orderTags)].forEach(tagName => {
            if (!tags[tagName]) tags[tagName] = { count: 0, total: 0 };
            tags[tagName].count += 1;
            tags[tagName].total += parseFloat(order.total || 0);
        });
    });

    let total_refund = 0;
    returnedOrders.forEach(order => {
        total_refund += parseFloat(order.total || order.amount || 0);
        let orderTags = [];
        if (order.tags) orderTags = order.tags.split(',').map(t => t.trim()).filter(t => t);
        if (order.delete_reason?.name) orderTags.push(order.delete_reason.name);
        [...new Set(orderTags)].forEach(tagName => {
            if (!tags[tagName]) tags[tagName] = { count: 0, total: 0 };
            tags[tagName].count += 1;
            tags[tagName].total += parseFloat(order.total || order.amount || 0);
        });
    });

    let total_deleted = 0;
    deletedOrders.forEach(order => {
        total_deleted += parseFloat(order.total || order.amount || 0);
        let orderTags = [];
        if (order.tags) orderTags = order.tags.split(',').map(t => t.trim()).filter(t => t);
        if (order.delete_reason?.name) orderTags.push(order.delete_reason.name);
        [...new Set(orderTags)].forEach(tagName => {
            if (!tags[tagName]) tags[tagName] = { count: 0, total: 0 };
            tags[tagName].count += 1;
            tags[tagName].total += parseFloat(order.total || order.amount || 0);
        });
    });

    return {
        byEmployee,
        bySaleMethod,
        byCategory,
        checksCount: checksCount || 0,
        grossTotal: parseFloat(grossSum || 0),
        payments,
        unpaid_payments,
        tags,
        total_amount,
        total_discount,
        total_service,
        total_gift,
        total_refund,
        total_deleted,
        total_tax,
        net_total,
        guest_count,
        total_paid,
        total_unpaid,
        delivery_fee,
    };
};

module.exports = {
    getReportData,
    getTerminals,
    getShiftSummaryForRange,
};
