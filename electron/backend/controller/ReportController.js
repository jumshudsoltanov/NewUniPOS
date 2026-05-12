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
        // String tarix müqayisəsi — Date obyektləri timezone problemi yaradır
        const startStr = `${startDate} ${startTime}:00`;
        const endStr = `${endDate} ${endTime}:00`;

        let baseWhere = { profile_id: profileId };
        if (terminal && terminal !== "all") baseWhere.terminal_id = terminal;

        // Bağlı sifarişlər — end_date ilə (admin paneli kimi)
        let closedWhere = {
            ...baseWhere,
            status: 2,
            end_date: { [Op.gte]: startStr, [Op.lte]: endStr },
        };

        let data = [];

        switch (reportType) {
            case "simple":
                data = await getSimpleReport(profileId, baseWhere, startStr, endStr);
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
                data = await getRefundsReport(baseWhere, startStr, endStr);
                break;
            case "gifted_products":
                data = await getGiftedProductsReport(closedWhere);
                break;
            case "financial":
                data = await getFinancialReport(baseWhere, startStr, endStr);
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

const getSimpleReport = async (profileId, baseWhere, startStr, endStr) => {
    const TagsModel = require("../model/TagsModel");

    const closedWhere = { ...baseWhere, status: 2, end_date: { [Op.gte]: startStr, [Op.lte]: endStr } };
    const openWhere = { ...baseWhere, status: 1, start_date: { [Op.gte]: startStr, [Op.lte]: endStr } };
    // Geri qaytarma (is_return=1) və silinmə ayrı — getShiftSummaryForRange ilə eyni məntiq
    const dateOnStart = { [Op.gte]: startStr, [Op.lte]: endStr };
    const returnedWhere = { ...baseWhere, status: 3, is_return: 1, start_date: dateOnStart };
    const deletedOnlyWhere = {
        ...baseWhere,
        status: 3,
        is_delete_reason_id: { [Op.not]: null },
        [Op.or]: [{ is_return: null }, { is_return: 0 }],
        start_date: dateOnStart,
    };
    const voidStatus0Where = { ...baseWhere, status: 0, start_date: dateOnStart };

    const [
        profile,
        closedAgg,       // Cəm, endirim, xidmət, qonaq — SQL-də hesablanır
        openAgg,         // Açıq sifarişlər
        refundAndDeletedAgg, // { returned, deletedOnly, status0 } — ayrıca cəmlər
        giftItems,       // İkram məhsulları
        payments,        // Ödənişlər
        closedTagOrders, // Etiket hesablaması üçün bağlı sifarişlər
    ] = await Promise.all([
        // 0. Profil (vergi faizi)
        LoginModel.findOne({ where: { id: profileId }, attributes: ['id', 'tax_percent'] }),

        // 1. Bağlı sifarişlər — SQL-də aggregate (sürətli)
        OrdersModel.findAll({
            where: closedWhere,
            attributes: [
                [fn('SUM', col('amount')), 'sum_amount'],
                [fn('SUM', col('rate_per_minute')), 'sum_timer'],
                [fn('SUM', col('discount')), 'sum_discount'],
                [fn('SUM', col('service_charge')), 'sum_service'],
                [fn('SUM', col('total')), 'sum_total'],
                [fn('SUM', col('guest_count')), 'sum_guests'],
                [fn('SUM', col('is_tax')), 'sum_is_tax'],
                [fn('COUNT', col('id')), 'cnt'],
            ],
            raw: true,
        }),

        // 2. Açıq sifarişlər — SQL aggregate
        OrdersModel.findAll({
            where: openWhere,
            attributes: [
                [fn('COUNT', col('id')), 'cnt'],
                [fn('SUM', col('total')), 'sum_total'],
            ],
            raw: true,
        }),

        // 3. Geri qaytarma (is_return=1) və çek silinməsi ayrı sütunlar üçün ayrı aggregate
        (async () => {
            const sumAttrs = [
                [fn("SUM", col("total")), "sum_total"],
                [fn("SUM", col("amount")), "sum_amount"],
            ];
            const [returnedRows, deletedOnlyRows, status0Rows] = await Promise.all([
                OrdersModel.findAll({
                    where: returnedWhere,
                    attributes: sumAttrs,
                    paranoid: false,
                    raw: true,
                }),
                OrdersModel.findAll({
                    where: deletedOnlyWhere,
                    attributes: sumAttrs,
                    paranoid: false,
                    raw: true,
                }),
                OrdersModel.findAll({
                    where: voidStatus0Where,
                    attributes: sumAttrs,
                    paranoid: false,
                    raw: true,
                }),
            ]);
            return {
                returnedRow: returnedRows[0] || {},
                deletedOnlyRow: deletedOnlyRows[0] || {},
                status0Row: status0Rows[0] || {},
            };
        })(),

        // 4. İkram məhsulları — yalnız lazımi sahələr
        OrdersItemsModel.findAll({
            include: [{
                model: OrdersModel, as: 'order', attributes: [], where: closedWhere, required: true,
            }, {
                model: ProductsModel, as: 'product', required: false, attributes: ['price'],
            }],
            where: { is_gift: 1 },
            attributes: ['count', 'price', 'original_price', 'modifiers'],
            raw: false,
        }),

        // 5. Ödənişlər — bağlı sifarişlərə aid (OrderPayments→Orders alias yoxdur, default 'OrdersModel')
        OrderPaymentsModel.findAll({
            include: [{
                model: OrdersModel, attributes: [], where: closedWhere, required: true,
            }, {
                model: PaymentMethodsModel, as: 'payment_method', required: false, attributes: ['name'],
            }, {
                model: TagsModel, as: 'tag', required: false, attributes: ['name'],
            }],
            attributes: ['id', 'paid', 'name', 'without_payment_method_id'],
            raw: false,
        }),

        // 6. Etiket hesablaması üçün bağlı sifarişlər (tags sahəsi + order_payments tags)
        OrdersModel.findAll({
            where: closedWhere,
            attributes: ['id', 'total', 'tags'],
            include: [{
                model: OrderPaymentsModel, as: 'order_payments', required: false,
                attributes: ['without_payment_method_id'],
                include: [{ model: TagsModel, as: 'tag', required: false, attributes: ['name'] }],
            }],
        }),
    ]);

    const taxPercent = parseFloat(profile?.tax_percent || 0);
    const aggRow = closedAgg[0] || {};
    const openRow = openAgg[0] || {};
    const retRow = refundAndDeletedAgg.returnedRow || {};
    const delOnlyRow = refundAndDeletedAgg.deletedOnlyRow || {};
    const void0Row = refundAndDeletedAgg.status0Row || {};

    // Vergi hesablaması — hər sifarişdə is_tax ilə dəqiq olmur SQL-də, ona görə bağlı sifarişlər üzərindən hesablayırıq
    // Sadə hal: tax = total * taxPercent / (100 + taxPercent) yalnız is_tax > 0 olan sifarişlər üçün
    // Bu aggregatda əlçatımlıdır: sum_is_tax > 0 olanlar üçün ortalama nisbəti
    // Daha dəqiq hesab üçün ayrı sorğu — ancaq ümumi hesabat üçün bu kifayətdir
    let total_tax = 0;
    if (taxPercent > 0 && parseFloat(aggRow.sum_is_tax || 0) > 0) {
        // is_tax > 0 olan sifarişlər üzrə tax hesablamaq üçün ayrı sorğu
        const taxOrders = await OrdersModel.findAll({
            where: { ...closedWhere, is_tax: { [Op.gt]: 0 } },
            attributes: ['total', 'is_tax'],
            raw: true,
        });
        taxOrders.forEach(o => {
            const t = parseFloat(o.total || 0);
            const flag = parseFloat(o.is_tax || 0);
            const pct = flag > 1 ? flag : taxPercent;
            if (pct > 0) total_tax += t * pct / (100 + pct);
        });
    }

    // İkram cəmi
    let total_gift = 0;
    giftItems.forEach(item => {
        const itemCount = parseFloat(item.count || 0);
        const itemPrice = parseFloat(item.price || 0);
        const origPrice = parseFloat(item.original_price || 0);
        const productPrice = parseFloat(item.product?.price || 0);
        const nominalPrice = itemPrice > 0 ? itemPrice : (origPrice > 0 ? origPrice : productPrice);
        let modifiersTotal = 0;
        try {
            const mods = Array.isArray(item.modifiers) ? item.modifiers : (typeof item.modifiers === 'string' ? JSON.parse(item.modifiers || '[]') : []);
            modifiersTotal = mods.reduce((s, m) => s + parseFloat(m.price || 0) * parseFloat(m.count || 1), 0);
        } catch (_) {}
        total_gift += itemCount * (nominalPrice + modifiersTotal);
    });

    // Ödəniş metodları
    const paymentsMap = {};
    const unpaidMap = {};
    let total_paid = 0, total_unpaid = 0;
    payments.forEach(p => {
        const amount = parseFloat(p.paid || 0);
        if (p.without_payment_method_id && p.without_payment_method_id > 0) {
            const name = p.name || p.tag?.name || 'Ödənişsiz';
            unpaidMap[name] = (unpaidMap[name] || 0) + amount;
            total_unpaid += amount;
        } else {
            const name = p.name || p.payment_method?.name || 'Nağd';
            paymentsMap[name] = (paymentsMap[name] || 0) + amount;
            total_paid += amount;
        }
    });

    // Etiketlər
    const tags = {};
    closedTagOrders.forEach(order => {
        const orderTotal = parseFloat(order.total || 0);
        const orderTags = new Set();
        if (order.tags) {
            order.tags.split(',').map(t => t.trim()).filter(t => t).forEach(t => orderTags.add(t));
        }
        if (order.order_payments) {
            order.order_payments.forEach(p => { if (p.tag?.name) orderTags.add(p.tag.name); });
        }
        orderTags.forEach(tagName => {
            if (!tags[tagName]) tags[tagName] = { count: 0, total: 0 };
            tags[tagName].count += 1;
            tags[tagName].total += orderTotal;
        });
    });

    return {
        total_amount: parseFloat(aggRow.sum_amount || 0) + parseFloat(aggRow.sum_timer || 0),
        total_discount: parseFloat(aggRow.sum_discount || 0),
        total_service: parseFloat(aggRow.sum_service || 0),
        total_gift,
        total_refund: parseFloat(retRow.sum_total || retRow.sum_amount || 0),
        total_deleted:
            parseFloat(delOnlyRow.sum_total || delOnlyRow.sum_amount || 0) +
            parseFloat(void0Row.sum_total || void0Row.sum_amount || 0),
        total_tax,
        net_total: parseFloat(aggRow.sum_total || 0),
        guest_count: parseInt(aggRow.sum_guests || 0),
        open_orders_count: parseInt(openRow.cnt || 0),
        open_orders_total: parseFloat(openRow.sum_total || 0),
        total_paid,
        total_unpaid,
        payments: paymentsMap,
        unpaid_payments: unpaidMap,
        tags,
    };
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
    const items = await OrdersItemsModel.findAll({
        attributes: ['product_id', 'count', 'price', 'original_price', 'modifiers', 'is_gift'],
        include: [
            {
                model: OrdersModel,
                as: 'order',
                attributes: [],
                where: whereClause,
                required: true,
            },
            { model: ProductsModel, as: 'product', attributes: ['id', 'name', 'price'], required: false }
        ],
        raw: false,
    });

    let productsMap = {};

    items.forEach(item => {
        const productId = item.product_id;
        const isGift = Number(item.is_gift) === 1 || item.is_gift === true;
        const itemCount = parseFloat(item.count || 0);
        const itemPrice = parseFloat(item.price || 0);
        const origPrice = parseFloat(item.original_price || 0);
        const productPrice = parseFloat(item.product?.price || 0);
        const nominalPrice = itemPrice > 0 ? itemPrice : (origPrice > 0 ? origPrice : productPrice);

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
            let modifiersTotalGift = 0;
            try {
                let mods = item.modifiers;
                if (typeof mods === "string") mods = JSON.parse(mods || "[]");
                if (Array.isArray(mods)) {
                    modifiersTotalGift = mods.reduce(
                        (s, m) => s + parseFloat(m.price || 0) * parseFloat(m.count || 1),
                        0
                    );
                }
            } catch (_) { /* ignore */ }
            productsMap[productId].quantity_gift += itemCount;
            productsMap[productId].total_gift += itemCount * (nominalPrice + modifiersTotalGift);
        } else {
            productsMap[productId].total += lineItemTotalForReport(item);
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
        attributes: ['id', 'total'],
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
    const items = await OrdersItemsModel.findAll({
        attributes: ['product_id', 'count', 'price', 'modifiers'],
        include: [
            {
                model: OrdersModel,
                as: 'order',
                attributes: [],
                where: whereClause,
                required: true,
            },
            {
                model: ProductsModel,
                as: 'product',
                attributes: ['id', 'name'],
                required: false,
                include: [{ model: CategoriesModel, as: 'category', attributes: ['name'], required: false }]
            }
        ],
        raw: false,
    });

    let categoryMap = {};

    items.forEach(item => {
        const categoryName = item.product?.category?.name || 'Kategoriyasız';
        const productLabel = item.product?.name || 'Naməlum';
        const productKey = item.product_id || productLabel;
        const lineTotal = lineItemTotalForReport(item);
        const qty = parseFloat(item.count || 0);

        if (!categoryMap[categoryName]) {
            categoryMap[categoryName] = { name: categoryName, quantity: 0, total: 0, products: {} };
        }
        const cat = categoryMap[categoryName];
        cat.quantity += qty;
        cat.total += lineTotal;

        if (!cat.products[productKey]) {
            cat.products[productKey] = { name: productLabel, quantity: 0, total: 0 };
        }
        cat.products[productKey].quantity += qty;
        cat.products[productKey].total += lineTotal;
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
        attributes: ['id', 'total', 'sale_type'],
        include: [{
            model: TablesModel,
            as: 'table',
            attributes: ['id', 'name'],
            include: [{ model: TableGroupsModel, as: 'hall', attributes: ['name'] }]
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
        attributes: ['id', 'total', 'rate_per_minute'],
        include: [{ model: TablesModel, as: 'table', attributes: ['name'] }]
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
        where: whereClause,
        attributes: ['id', 'total', 'sale_type']
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
            start_date: { [Op.gte]: start, [Op.lte]: end }
        },
        include: [{ model: WaitersModel, as: 'waiter', attributes: ['name'] }],
        order: [['start_date', 'DESC']],
        paranoid: false,
    });
    return orders.map(o => o.toJSON());
};

const getFinancialReport = async (baseWhere, start, end) => {
    const TagsModel = require("../model/TagsModel");
    const orders = await OrdersModel.findAll({
        where: {
            ...baseWhere,
            status: 2,
            end_date: { [Op.gte]: start, [Op.lte]: end }
        },
        attributes: ['id'],
        include: [{
            model: OrderPaymentsModel,
            as: 'order_payments',
            required: false,
            attributes: ['id', 'paid', 'name', 'without_payment_method_id'],
            include: [
                { model: PaymentMethodsModel, as: 'payment_method', required: false, attributes: ['name'] },
                { model: TagsModel, as: 'tag', required: false, attributes: ['name'] }
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
    const items = await OrdersItemsModel.findAll({
        where: { is_gift: 1 },
        attributes: ['count'],
        include: [
            {
                model: OrdersModel,
                as: 'order',
                attributes: ['id', 'end_date'],
                where: whereClause,
                required: true,
            },
            { model: ProductsModel, as: 'product', attributes: ['name'], required: false }
        ],
        raw: false,
    });

    return items.map(item => ({
        order_id: item.order?.id,
        product_name: item.product?.name || 'Naməlum',
        quantity: item.count,
        time: item.order?.end_date
    }));
};

const getCustomersReport = async (whereClause) => {
    const orders = await OrdersModel.findAll({
        where: whereClause,
        attributes: ['id', 'total', 'customer_id']
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
    const TagsModel = require("../model/TagsModel");

    // String tarix müqayisəsi — Date obyektlərini lokal vaxt sətrinə çevir
    const fmt = (d) => {
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    };
    const startVal = startStr instanceof Date ? fmt(startStr) : startStr;
    const endVal   = endStr   instanceof Date ? fmt(endStr)   : endStr;

    const baseWhere = { profile_id: profileId };
    if (terminalId && String(terminalId) !== "all") {
        baseWhere.terminal_id = terminalId;
    }
    const closedWhere = { ...baseWhere, status: 2, end_date: { [Op.gte]: startVal, [Op.lte]: endVal } };
    const returnedWhere = { ...baseWhere, status: 3, is_return: 1, start_date: { [Op.gte]: startVal, [Op.lte]: endVal } };
    const deletedWhere  = { ...baseWhere, status: 3, is_delete_reason_id: { [Op.not]: null }, [Op.or]: [{ is_return: null }, { is_return: 0 }], start_date: { [Op.gte]: startVal, [Op.lte]: endVal } };

    const [
        profile,
        byEmployee,
        bySaleMethod,
        byCategory,
        closedAgg,
        taxOrders,
        giftItems,
        payments,
        closedTagOrders,
        returnedAgg,
        deletedAgg,
    ] = await Promise.all([
        LoginModel.findOne({ where: { id: profileId }, attributes: ['id', 'tax_percent'] }),
        getEmployeeReport(closedWhere),
        getSaleMethodReport(closedWhere),
        getCategoryReport(closedWhere),

        // Bağlı sifarişlər — SQL aggregate (sürətli)
        OrdersModel.findAll({
            where: closedWhere,
            attributes: [
                [fn('SUM', col('amount')), 'sum_amount'],
                [fn('SUM', col('rate_per_minute')), 'sum_timer'],
                [fn('SUM', col('discount')), 'sum_discount'],
                [fn('SUM', col('service_charge')), 'sum_service'],
                [fn('SUM', col('delivery_fee')), 'sum_delivery'],
                [fn('SUM', col('total')), 'sum_total'],
                [fn('SUM', col('guest_count')), 'sum_guests'],
                [fn('SUM', col('is_tax')), 'sum_is_tax'],
                [fn('COUNT', col('id')), 'cnt'],
            ],
            raw: true,
        }),

        // Vergi hesablaması üçün yalnız is_tax > 0 olan sifarişlər
        OrdersModel.findAll({
            where: { ...closedWhere, is_tax: { [Op.gt]: 0 } },
            attributes: ['total', 'is_tax'],
            raw: true,
        }),

        // İkram məhsulları
        OrdersItemsModel.findAll({
            include: [{ model: OrdersModel, as: 'order', attributes: [], where: closedWhere, required: true },
                      { model: ProductsModel, as: 'product', required: false, attributes: ['price'] }],
            where: { is_gift: 1 },
            attributes: ['count', 'price', 'original_price', 'modifiers'],
            raw: false,
        }),

        // Ödənişlər — OrderPaymentsModel→OrdersModel alias yoxdur
        OrderPaymentsModel.findAll({
            include: [
                { model: OrdersModel, attributes: [], where: closedWhere, required: true },
                { model: PaymentMethodsModel, as: 'payment_method', required: false, attributes: ['name'] },
                { model: TagsModel, as: 'tag', required: false, attributes: ['name'] },
            ],
            attributes: ['id', 'paid', 'name', 'without_payment_method_id'],
            raw: false,
        }),

        // Etiket hesablaması üçün bağlı sifarişlər
        OrdersModel.findAll({
            where: closedWhere,
            attributes: ['id', 'total', 'tags'],
            include: [{
                model: OrderPaymentsModel, as: 'order_payments', required: false,
                attributes: ['without_payment_method_id'],
                include: [{ model: TagsModel, as: 'tag', required: false, attributes: ['name'] }],
            }],
        }),

        // Geri qaytarılmış sifarişlər — aggregate
        OrdersModel.findAll({
            where: returnedWhere,
            attributes: [[fn('SUM', col('total')), 'sum_total']],
            paranoid: false,
            raw: true,
        }),

        // Silinmiş sifarişlər — aggregate
        OrdersModel.findAll({
            where: deletedWhere,
            attributes: [[fn('SUM', col('total')), 'sum_total']],
            paranoid: false,
            raw: true,
        }),
    ]);

    const taxPercent = parseFloat(profile?.tax_percent || 0);
    const aggRow = closedAgg[0] || {};

    let total_tax = 0;
    if (taxPercent > 0) {
        taxOrders.forEach(o => {
            const t = parseFloat(o.total || 0);
            const flag = parseFloat(o.is_tax || 0);
            const pct = flag > 1 ? flag : taxPercent;
            if (pct > 0) total_tax += t * pct / (100 + pct);
        });
    }

    let total_gift = 0;
    giftItems.forEach(item => {
        const qty = parseFloat(item.count || 0);
        const price = parseFloat(item.price || 0);
        const orig = parseFloat(item.original_price || 0);
        const prodPrice = parseFloat(item.product?.price || 0);
        const nominal = price > 0 ? price : (orig > 0 ? orig : prodPrice);
        let mods = 0;
        try {
            const ms = Array.isArray(item.modifiers) ? item.modifiers : (typeof item.modifiers === 'string' ? JSON.parse(item.modifiers || '[]') : []);
            mods = ms.reduce((s, m) => s + parseFloat(m.price || 0) * parseFloat(m.count || 1), 0);
        } catch (_) {}
        total_gift += qty * (nominal + mods);
    });

    const paymentsMap = {};
    const unpaid_payments = {};
    let total_paid = 0, total_unpaid = 0;
    payments.forEach(p => {
        const amount = parseFloat(p.paid || 0);
        if (p.without_payment_method_id && p.without_payment_method_id > 0) {
            const name = p.name || p.tag?.name || 'Ödənişsiz';
            unpaid_payments[name] = (unpaid_payments[name] || 0) + amount;
            total_unpaid += amount;
        } else {
            const name = p.name || p.payment_method?.name || 'Nağd';
            paymentsMap[name] = (paymentsMap[name] || 0) + amount;
            total_paid += amount;
        }
    });

    const tags = {};
    closedTagOrders.forEach(order => {
        const orderTotal = parseFloat(order.total || 0);
        const orderTags = new Set();
        if (order.tags) order.tags.split(',').map(t => t.trim()).filter(Boolean).forEach(t => orderTags.add(t));
        if (order.order_payments) order.order_payments.forEach(p => { if (p.tag?.name) orderTags.add(p.tag.name); });
        orderTags.forEach(tagName => {
            if (!tags[tagName]) tags[tagName] = { count: 0, total: 0 };
            tags[tagName].count += 1;
            tags[tagName].total += orderTotal;
        });
    });

    return {
        byEmployee,
        bySaleMethod,
        byCategory,
        checksCount: parseInt(aggRow.cnt || 0),
        grossTotal: parseFloat(aggRow.sum_total || 0),
        payments: paymentsMap,
        unpaid_payments,
        tags,
        total_amount: parseFloat(aggRow.sum_amount || 0) + parseFloat(aggRow.sum_timer || 0),
        total_discount: parseFloat(aggRow.sum_discount || 0),
        total_service: parseFloat(aggRow.sum_service || 0),
        total_gift,
        total_refund: parseFloat(returnedAgg[0]?.sum_total || 0),
        total_deleted: parseFloat(deletedAgg[0]?.sum_total || 0),
        total_tax,
        net_total: parseFloat(aggRow.sum_total || 0),
        guest_count: parseInt(aggRow.sum_guests || 0),
        total_paid,
        total_unpaid,
        delivery_fee: parseFloat(aggRow.sum_delivery || 0),
    };
};

module.exports = {
    getReportData,
    getTerminals,
    getShiftSummaryForRange,
};
