// ----------------------------------------------------------------------------------//
// Login Timer Lambda Function
// Charlie (( BETA v2.1 ))
// CRKS | August 14, 2018 | Updated:
// ----------------------------------------------------------------------------------//

const request = require('request-promise')
const crypto = require('crypto')

// meta information
const meta = require('../meta.json')
const DB = Object.assign(meta.secrets.db)
const REGION = meta.region

// GLOBALS
const URI = meta.api.bots
const STAGE = meta.stage

const API = {
  login: `${URI}${STAGE}/login`,
  mail:  `${URI}${STAGE}/mail`
}

// DB bullshit
const Sequelize = require('sequelize')
const sequelize = new Sequelize(DB.database, DB.user, DB.pass, {
  host: DB.host,
  dialect: 'mysql',
  timezone: 'est',
  operatorsAliases: false,
  logging: false,

  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
})

const Account = sequelize.define('Account', {
  enabled: Sequelize.BOOLEAN,
  trial: Sequelize.BOOLEAN,
  username: Sequelize.STRING,
  email: Sequelize.STRING,
  passphrase: Sequelize.STRING,
  accounts: Sequelize.STRING,
  loggedIn: { type: Sequelize.BOOLEAN, defaultValue: false },
  cookie: Sequelize.STRING,
  region: Sequelize.STRING,
  follow: { type: Sequelize.BOOLEAN, defaultValue: false },
  scrape: { type: Sequelize.BOOLEAN, defaultValue: false },
  timer: Sequelize.INTEGER,
})

module.exports.handler = async (event, context, callback) => {

    const decrypt = (hash) => {
      return new Promise((resolve, reject) => {
        let decipher = crypto.createDecipher('aes-256-ctr', 'gd2814D')
        let decrypted = decipher.update(hash,'hex','utf8')
        decrypted += decipher.final('utf8');
        resolve(decrypted);
      })
    }

    const getAccounts = (message) => {
      return new Promise(async (resolve, reject) => {
        try {
          const accounts = await Account.findAll({ where: message, raw: true })
          resolve(accounts)
        }
        catch (error) {
          reject(error)
        }
      })
    }

    const sendEmail = (username, address, followers, email) => {
      return new Promise(async (resolve, reject) => {
        try {
          console.log(`::SENDING MAIL:: user: ${username}, email: ${email}`)
          await request({
            method: 'POST',
            uri: API.mail,
            body: {
              username: username,
              address: address,
              followers: followers,
              email: email
            },
            json: true
          })
          resolve ()
        }
        catch (error) {
          reject (error)
        }
      })
    }

    try {
      const accounts = await getAccounts({enabled: true})
      accounts.forEach(async (account) => {
        try {
          if (!account.loggedIn) {
            // ----------------------- NOT LOGGED IN ---------------------------
            console.log(`::Attempting to login user: ${account.username}`)
            const pass = await decrypt(account.passphrase)
            const loginResponse = await request({
              method: 'POST',
              uri: API.login,
              body: {
                user: account.username,
                pass: pass
              },
              json: true
            })
            console.log(loginResponse)
            if (loginResponse.message == 'WP') {
              console.log('::NOTE:: Sending WP email to: ' + account.username)
              // ::::: SEND EMAIL TO CUSTOMER HERE :::::: ----------------------
              await sendEmail(account.username, account.email, 0, 'wp')
              await Account.update({ enabled: false }, { where: { username: account.username } })
            } else if (loginResponse.message == 'UA') {
              // ::::: SEND EMAIL TO CUSTOMER HERE :::::: ----------------------
              console.log('::NOTE:: Sending UA email to: ' + account.username)
              await sendEmail(account.username, account.email, 0, 'ua')
              await Account.update({ enabled: false }, { where: { username: account.username } })
            }
          }
        }
        catch (err) {
          console.log('Timer Error - could be a response timeout.') // Turned off because it was flagging 30 sec timeouts...
          console.log(err)
        }
      })
    }
    catch (err) {
      console.log('ERROR 2')
      console.log(err)
    }

  const response = {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Timer running.',
      input: event,
    }),
  };

  callback(null, response);
}

//local testing...
// module.exports.handler()
