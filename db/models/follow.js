'use strict';
module.exports = (sequelize, DataTypes) => {
  var Follow = sequelize.define('Follow', {
    username: DataTypes.STRING,
    parent: DataTypes.STRING,
    account: DataTypes.STRING,
    followed: DataTypes.BOOLEAN,
    unfollowed: DataTypes.BOOLEAN
  }, {});
  Follow.associate = function(models) {
    // associations can be defined here
  };
  return Follow;
};