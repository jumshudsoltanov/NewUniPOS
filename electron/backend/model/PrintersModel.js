const { DataTypes } = require("sequelize");
const db = require("../database/config");

const PrintersModel = db.sequelize.define(
  "printers",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    profile_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    name: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    local_name: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    is_cashier: {
      type: DataTypes.TINYINT,
      allowNull: true,
    },
    type: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    ip: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    port: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    connection_type: {
      type: DataTypes.TEXT, // 'network' or 'usb'
      defaultValue: 'network',
    },
    usb_name: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    paper_width: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 48,
    },
    trailing_space: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    sound_notify: {
      type: DataTypes.TINYINT,
      allowNull: true,
      defaultValue: 0,
    },
    cash_drawer: {
      type: DataTypes.TINYINT,
      allowNull: true,
      defaultValue: 0,
    },
    fast_print: {
      type: DataTypes.TINYINT,
      allowNull: true,
      defaultValue: 0,
    },
    font_family: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: 'Arial',
    },
    paper_size: {
      type: DataTypes.TEXT, // '58' or '80'
      allowNull: true,
      defaultValue: '80',
    },
    cut_mode: {
      type: DataTypes.TEXT, // 'full', 'partial', 'none'
      allowNull: true,
      defaultValue: 'full',
    },
    rotate_180: {
      type: DataTypes.TINYINT,
      allowNull: true,
      defaultValue: 0,
    },
    encoding: {
      type: DataTypes.TEXT, // 'utf8', 'cp1251', 'cp866'
      allowNull: true,
      defaultValue: 'utf8',
    },
    copies: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 1,
    },
    darkness: {
      type: DataTypes.INTEGER, // 1-10, ESC/POS print density
      allowNull: true,
      defaultValue: 5,
    },
    receipt_header: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },
    receipt_footer: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },
    bold_header: {
      type: DataTypes.TINYINT,
      allowNull: true,
      defaultValue: 0,
    },
    double_height_header: {
      type: DataTypes.TINYINT,
      allowNull: true,
      defaultValue: 0,
    },
    print_logo: {
      type: DataTypes.TINYINT,
      allowNull: true,
      defaultValue: 0,
    },
    open_drawer_without_print: {
      type: DataTypes.TINYINT, // pul yeşiyini çap olmadan aç (manual trigger)
      allowNull: true,
      defaultValue: 0,
    },
  },
  {
    tableName: "printers",
    timestamps: true,
    paranoid: true, // soft delete
    underscored: true,
  },
);

module.exports = PrintersModel;
