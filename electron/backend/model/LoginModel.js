const { DataTypes } = require("sequelize");
const db = require("../database/config");

const LoginModel = db.sequelize.define(
  "profiles",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    is_master: {
      type: DataTypes.TINYINT,
      defaultValue: 0,
    },

    logo: DataTypes.TEXT("long"),
    super_admin_logo: DataTypes.TEXT("long"),

    restaurant_name: DataTypes.TEXT,
    username: DataTypes.TEXT,
    password: DataTypes.TEXT,

    sale_date: DataTypes.DATEONLY,
    sale_type: DataTypes.INTEGER,
    payment: DataTypes.FLOAT,
    next_payment_date: DataTypes.DATEONLY,

    boss_name: DataTypes.TEXT,
    boss_phone_number: DataTypes.TEXT,

    production_name: DataTypes.TEXT,
    production_phone_number: DataTypes.TEXT,

    region: DataTypes.TEXT,

    start_time: DataTypes.TIME,
    end_time: DataTypes.TIME,

    is_contract: DataTypes.TINYINT,
    is_working: DataTypes.INTEGER,

    is_pos: DataTypes.TINYINT,
    is_menu: DataTypes.TINYINT,
    is_tax: DataTypes.TINYINT,

    is_telegram_notify: DataTypes.TINYINT,
    is_whatsapp_notify: DataTypes.TINYINT,

    is_pos_block: DataTypes.TINYINT,
    is_menu_block: DataTypes.INTEGER,

    background_img: DataTypes.TEXT("long"),
    email: DataTypes.TEXT("long"),
    phone: DataTypes.TEXT("long"),
    address: DataTypes.TEXT("long"),
    about: DataTypes.TEXT("long"),

    facebook: DataTypes.TEXT,
    instagram: DataTypes.TEXT,
    tiktok: DataTypes.TEXT,
    twitter: DataTypes.TEXT,
    website: DataTypes.TEXT,

    wifi_ssid: DataTypes.TEXT,
    wifi_password: DataTypes.TEXT,

    service_fee: DataTypes.TEXT,
    open_hours: DataTypes.TEXT,

    tax_percent: DataTypes.INTEGER,
    tax_merchant: DataTypes.TEXT,
    tax_type: DataTypes.INTEGER,
    tax_cash_type: DataTypes.TEXT,

    ip_addr: DataTypes.TEXT,
    port_addr: DataTypes.TEXT,

    telegram_chat_id: DataTypes.TEXT,
    whatsapp_chat_number: DataTypes.TEXT,

    kitchen_receipt: DataTypes.INTEGER,
    customer_receipt: DataTypes.INTEGER,

    is_scroll: DataTypes.INTEGER,
    is_timer: DataTypes.INTEGER,

    parent_id: DataTypes.INTEGER,
    is_sprt_printer: DataTypes.INTEGER,
    qr_on_check: DataTypes.INTEGER,

    inventory_auto_deduct: {
      type: DataTypes.TINYINT,
      defaultValue: 0,
    },

    is_warehouse: {
      type: DataTypes.TINYINT,
      defaultValue: 0,
    },

    is_master_cashier_printing: {
      type: DataTypes.TINYINT,
      defaultValue: 0,
    },
    is_master_product_printing: {
      type: DataTypes.TINYINT,
      defaultValue: 0,
    },
    is_customer_receipt_auto_print: {
      type: DataTypes.TINYINT,
      defaultValue: 0,
    },
    is_customer_display_active: {
      type: DataTypes.TINYINT,
      defaultValue: 0,
    },
    customer_display_screen_id: DataTypes.TEXT,
    is_kitchen_display_active: {
      type: DataTypes.TINYINT,
      defaultValue: 0,
    },
    kitchen_display_screen_id: DataTypes.TEXT,
    mobile_token: DataTypes.TEXT,
  },
  {
    modelName: "LoginModel",
    underscored: true,
    tableName: "profiles",
    timestamps: true,
    paranoid: true,
  },
);

module.exports = LoginModel;
