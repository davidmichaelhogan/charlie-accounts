'use strict';
module.exports = (sequelize, DataTypes) => {
  var Account = sequelize.define('Account', {
    enabled: DataTypes.BOOLEAN,
    trial: DataTypes.BOOLEAN,
    username: DataTypes.STRING,
    email: DataTypes.STRING,
    passphrase: DataTypes.STRING,
    accounts: DataTypes.STRING,
    region: DataTypes.STRING,
    loggedIn: DataTypes.BOOLEAN,
    cookie: DataTypes.TEXT,
    follow: DataTypes.BOOLEAN,
    scrape: DataTypes.BOOLEAN,
    timer: DataTypes.INTEGER
  }, {});
  Account.associate = function(models) {
    // associations can be defined here
  };
  return Account;
};