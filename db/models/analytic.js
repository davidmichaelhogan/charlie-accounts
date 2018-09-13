'use strict';
module.exports = (sequelize, DataTypes) => {
  var Analytic = sequelize.define('Analytic', {
    username: DataTypes.STRING,
    followers: DataTypes.INTEGER,
    following: DataTypes.INTEGER
  }, {});
  Analytic.associate = function(models) {
    // associations can be defined here
  };
  return Analytic;
};