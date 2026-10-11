const { DataTypes } = require("sequelize");
const db = require("../database/config");

const WaitersModel = db.sequelize.define(
  "waiters",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: true,
    },
    profile_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    img: {
      type: DataTypes.TEXT("long"),
      allowNull: true,
      defaultValue: "0",
    },
    name: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: "0",
    },
    username: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: "0",
    },
    password: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: "0",
    },
    pin: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: "0",
    },
    card_id: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: "0",
    },
    can_edit_all_checks: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    can_edit_service_fee: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    can_change_table: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    can_edit_guest_count: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    can_merge_checks: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    can_change_sale_type: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    can_change_waiter: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    can_add_discount: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    can_delete_product: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    can_close_without_payment: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    can_create_report: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    can_delete_check: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    can_change_product_price: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    can_view_archived_checks: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    can_print_before_close: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    can_access_own_checks_only: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    cannot_close_check: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    can_lock_check: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    can_access_settings: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    can_add_expense: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    can_give_treats: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    can_give_deposit: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    can_split_receipt: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    can_return_receipt: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    can_see_notif: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    can_see_device: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    can_see_tax: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    can_block_customer_on_check: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    can_see_total: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    can_manage_packs: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    require_comment_for_price_change: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: 0,
    },
    can_transfer_product_between_tables: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: 0,
    },
    can_view_logs: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    can_view_customers: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    can_clear_check: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    can_add_check_comment: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    can_transfer_product: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    can_give_product_discount: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    can_manage_products: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    can_edit_table_design: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    can_create_order: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    can_see_shortcuts: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    can_see_sale_type_queue: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    can_see_shift_history: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    is_local: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    /**
     * QR sifarişləri üçün ofisiant. Admin paneldən seçilir və API-dən gəlir.
     * `direct` rejimdə QR-dan gələn sifariş avtomatik bu ofisiantın adına
     * yazılır. `manual` rejimdə isə sifarişi kim təsdiqləyirsə o düşür.
     * Bax: QR_ORDER_POS_PLAN.md
     */
    is_qr_user: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
  },
  {
    tableName: "waiters",
    timestamps: true,
    paranoid: true,
    underscored: true,
  },
);

module.exports = WaitersModel;
