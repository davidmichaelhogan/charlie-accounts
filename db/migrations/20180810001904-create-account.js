'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('Accounts', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      enabled: {
        type: Sequelize.BOOLEAN
      },
      trial: {
        type: Sequelize.BOOLEAN
      },
      username: {
        type: Sequelize.STRING
      },
      email: {
        type: Sequelize.STRING
      },
      passphrase: {
        type: Sequelize.STRING
      },
      accounts: {
        type: Sequelize.STRING
      },
      region: {
        type: Sequelize.STRING
      },
      loggedIn: {
        type: Sequelize.BOOLEAN
      },
      cookie: {
        type: Sequelize.TEXT
      },
      follow: {
        type: Sequelize.BOOLEAN
      },
      scrape: {
        type: Sequelize.BOOLEAN
      },
      timer: {
        type: Sequelize.INTEGER
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('Accounts');
  }
};