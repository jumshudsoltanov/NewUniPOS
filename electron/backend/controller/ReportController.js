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
                [Op.between]: [startStr, endStr],
            },
        };

        let data = [];

        switch (reportType) {
            case "simple":
                data = await getSimpleReport(profileId, baseWhere, startStr, endStr, showTransactions === 'true');
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
                include: [
                    { model: PaymentMethodsModel, as: 'payment_method' },
                    { model: require("../model/TagsModel"), as: 'tag' }
                ]
            },
            {
                model: OrdersItemsModel,
                as: 'orders_items'
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
        payments: {},
        tags: {}
    };

    // Process Closed Orders
    closedOrders.forEach(order => {
        // order.amount is subtotal
        summary.total_amount += parseFloat(order.amount || 0);
        summary.total_discount += parseFloat(order.discount || 0);
        summary.total_service += parseFloat(order.service_charge || 0);
        const orderTotal = parseFloat(order.total || 0);
        summary.net_total += orderTotal;
        summary.guest_count += parseInt(order.guest_count || 0);

        // Tax calculation: inclusive VAT = total * taxPercent / (100 + taxPercent)
        if (order.is_tax === 1 && taxPercent > 0) {
            summary.total_tax += orderTotal * taxPercent / (100 + taxPercent);
        }

        // Calculate Gifts within these orders
        if (order.orders_items) {
            order.orders_items.forEach(item => {
                if (item.is_gift === 1) {
                    summary.total_gift += parseFloat(item.count || 0) * parseFloat(item.price || 0);
                }
            });
        }

        // Payments summary
        if (order.order_payments) {
            order.order_payments.forEach(p => {
                const methodName = p.payment_method?.name || (p.without_payment_method_id ? 'Ödənişsiz' : 'Digər');
                summary.payments[methodName] = (summary.payments[methodName] || 0) + parseFloat(p.paid || 0);
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
                if (!productsMap[productId]) {
                    productsMap[productId] = {
                        name: item.product?.name || 'Naməlum',
                        quantity: 0,
                        total: 0
                    };
                }
                productsMap[productId].quantity += parseFloat(item.count || 0);
                productsMap[productId].total += parseFloat(item.count || 0) * parseFloat(item.price || 0);
            });
        }
    });

    return Object.values(productsMap).sort((a, b) => b.total - a.total);
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
                if (!categoryMap[categoryName]) {
                    categoryMap[categoryName] = {
                        name: categoryName,
                        quantity: 0,
                        total: 0
                    };
                }
                categoryMap[categoryName].quantity += parseFloat(item.count || 0);
                categoryMap[categoryName].total += parseFloat(item.count || 0) * parseFloat(item.price || 0);
            });
        }
    });

    return Object.values(categoryMap).sort((a, b) => b.total - a.total);
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
            include: [
                { model: PaymentMethodsModel, as: 'payment_method' },
                { model: require("../model/TagsModel"), as: 'tag' }
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
        takeaway: 'Takeaway',
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
                total: 0
            };
        }
        tableMap[tableName].checks_count += 1;
        tableMap[tableName].total += parseFloat(order.total || 0);
    });

    return Object.values(tableMap).sort((a, b) => b.total - a.total);
};

const getSaleMethodReport = async (whereClause) => {
    const orders = await OrdersModel.findAll({
        where: whereClause
    });

    let methodMap = {
        'dine_in': { name: 'Zalda', count: 0, total: 0 },
        'takeaway': { name: 'Götür', count: 0, total: 0 },
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
            include: [{ model: PaymentMethodsModel, as: 'payment_method' }]
        }]
    });

    let paymentMap = {};
    let total = 0;

    orders.forEach(order => {
        if (order.order_payments) {
            order.order_payments.forEach(p => {
                const name = p.payment_method?.name || 'Digər';
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

module.exports = {
    getReportData,
    getTerminals
};
