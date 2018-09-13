// ----------------------------------------------------------------------------------//
// Timer Lambda Function
// Charlie (( BETA v2.1 ))
// CRKS | June 9, 2018 | Updated: August 22, 2018
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
  analytics: `${URI}${STAGE}/analytics`,
  mail: `${URI}${STAGE}/mail`
}

// rand function
function rand(min,max) {
  return Math.floor(Math.random()*(max-min+1)+min)
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

const Follow = sequelize.define('Follow', {
  username: Sequelize.STRING,
  parent: Sequelize.STRING,
  account: Sequelize.STRING,
  followed: { type: Sequelize.BOOLEAN, defaultValue: false },
  unfollowed: { type: Sequelize.BOOLEAN, defaultValue: false }
})

const Analytic = sequelize.define('Analytic', {
  username: Sequelize.STRING,
  followers: Sequelize.INTEGER,
  following: Sequelize.INTEGER
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

    const runAnalytics = (account) => {
      return new Promise(async (resolve, reject) => {
        try {
          console.log(`::GETTING ANALYTICS:: user: ${account.username}`)
          await request({
            method: 'POST',
            uri: API.analytics,
            body: {
              username: account.username,
              cookie: account.cookie
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
          const followCount = await Follow.count({ where: { username: account.username, followed: false } })
          if (account.loggedIn) {
            // ------------------------ Email Functions --------------------------
            // calculate days and info
            const today = new Date()
            const fourDays = (24*60*60*1000) * 4 // 4 days
            const fourDaysAgo = new Date(today.getTime() - fourDays)
            const sevenDays = (24*60*60*1000) * 7 // 7 days
            const sevenDaysAgo = new Date(today.getTime() - sevenDays)
            // get number of records
            const analyticsCount = await Analytic.count({ where: { username: account.username } })
            const analyticsRecords = await Analytic.findAll({ where: { username: account.username, updatedAt: { $gt: fourDaysAgo } }, raw: true })
            // get number of followers
            const currentFollowers = analyticsRecords[analyticsRecords.length - 1].followers
            const previousFollowers = analyticsRecords[analyticsRecords.length - 2].followers
            const followerGain = currentFollowers - previousFollowers
            // check if there is enough records
            if (analyticsRecords.length > 6) {
              //get last two entries
              const currentFollowers = analyticsRecords[analyticsRecords.length - 1].followers
              const previousFollowers = analyticsRecords[analyticsRecords.length - 2].followers
              // calculate follower gain
              const followerGain = currentFollowers - previousFollowers
              // check for issues
              if (followerGain < 150 && account.follow && !account.trial) {
                console.log(`::WARNING:: ${account.username} has only gained ${followerGain} followers! ::WARNING::`)
                // ::::: SEND EMAIL TO ADMIN HERE :::::: -------------------------
                await sendEmail(account.username, 'david@longestroadmedia.com', 0, 'error')
              } else {
                // log follower gain
                console.log(`::NOTE:: ${account.username} has gained ${followerGain} followers in 12 hours.`)
              }
            }

            // ------------------------ CHECK FOR TRIAL --------------------------
            if (account.timer > 1750 && !account.follow && account.trial) {
              const trialFollowers = currentFollowers - analyticsRecords[0].followers
              // turn off account at end of trial
              await Account.update({ enabled: false, trial: false }, { where: { username: account.username } })
              console.log(`::NOTE:: Trial has ended for: ${account.username}, sending email!`)
              // ::::: SEND EMAIL TO CUSTOMER HERE :::::: ------------------------
              await sendEmail(account.username, account.email, trialFollowers, 'trial_2')
              // ADD MIXMAX API HERE !!!


            }
            // -------------------------- MONTHLY EMAIL --------------------------
            const shouldEmail = Number.isInteger(analyticsCount / 60)
            if (shouldEmail) {
              const mailFollowers = currentFollowers - analyticsRecords[analyticsRecords.length - 60]
              // ::::: SEND EMAIL TO CUSTOMER HERE :::::: ------------------------
              await sendEmail(account.username, account.email, currentFollowers, 'monthly')
            }
          }
        }
        catch (err) {
          // console.log('Timer Error - could be a response timeout.') // Turned off because it was flagging 30 sec timeouts...
          //console.log(err)
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
