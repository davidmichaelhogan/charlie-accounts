// ----------------------------------------------------------------------------------//
// Timer Lambda Function
// Charlie (( BETA v2.1 ))
// CRKS | June 9, 2018 | Updated: August 21, 2018
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
  login:    `${URI}${STAGE}/login`,
  follow:   `${URI}${STAGE}/follow`,
  unfollow: `${URI}${STAGE}/unfollow`,
  scrape:   `${URI}${STAGE}/scrape`
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

    const updateAccount = (account) => {
      return new Promise(async (resolve, reject) => {
        try {
          const result = await Account.update(account, { where: { username: account.username } })
          resolve(result)
        }
        catch (error) {
          reject (error)
        }
      })
    }

    const follow = (account, ind) => {
      return new Promise(async (resolve, reject) => {
        try {
          let target = await Follow.find({ where: { username: account.username, followed: false }, order: [ Sequelize.fn('RAND') ] })
          if (target) {
            console.log(`::FOLLOW:: user: ${account.username} || target: ${target.account}`)
            await Follow.update({ followed: true }, { where: { id: target.id } })

            await request({
              method: 'POST',
              uri: API.follow,
              body: {
                target: target.account,
                username: account.username,
                cookie: account.cookie
              },
              json: true
            })
          } else {
            console.log('NO ONE LEFT TO FOLLOW')
          }

          resolve ()
        }
        catch (error) {
          reject (error)
        }
      })
    }

    const unfollow = (account, ind) => {
      return new Promise(async (resolve, reject) => {
        try {
          let target = await Follow.find({ where: { username: account.username, followed: true, unfollowed: false }, order: [ Sequelize.fn('RAND') ] })
          if (target) {
            console.log(`::UNFOLLOW:: user: ${account.username} || target: ${target.account}`)
            await Follow.update({ unfollowed: true }, { where: { id: target.id } })

            await request({
              method: 'POST',
              uri: API.unfollow,
              body: {
                target: target.account,
                username: account.username,
                cookie: account.cookie
              },
              json: true
            })
          } else {
            console.log('NO ONE LEFT TO FOLLOW')
          }

          resolve ()
        }
        catch (error) {
          reject (error)
        }
      })
    }

    const scrape = (account, target) => {
      return new Promise(async (resolve, reject) => {
        try {
          let randAccount = await Account.find({ where: { loggedIn: true }, order: [ Sequelize.fn('RAND') ], raw: true })
          console.log(`::SCRAPE:: user: ${account.username} || target: ${target}`)
          await request({
            method: 'POST',
            uri: API.scrape,
            body: {
              target: target,
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

    try {
      const accounts = await getAccounts({enabled: true})
      accounts.forEach(async (account) => {
        try {
          const followCount = await Follow.count({ where: { username: account.username, followed: false } })
          if (!account.loggedIn) {
            // ----------------------- NOT LOGGED IN ---------------------------
            // console.log(`::PLEASE LOGIN:: user: ${account.username}`)

          } else if (followCount < 20) { // There are no options in follow table
            // ------------------------ RUN SCRAPER ----------------------------
            // console.log(`::PLEASE SCRAPE:: user: ${account.username}`)

            let accountParents = account.accounts.replace(/@/g, '').replace(/ /g, ',').split(',') // ------------- !! MOVE THIS SHIT TO THE FORM !! -------------
            accountParents = accountParents.filter((account) => { return account !== "" })
            let accountToScrape = accountParents[rand(0, accountParents.length - 1)]

            // scrape account
            if (account.scrape) {
              console.log(`::SCRAPE || SET TO OFF :: user: ${account.username}`)
            } else if (accountToScrape) {
              account.scrape = true
              await updateAccount(account)
              await scrape(account, accountToScrape)
              // console.log(`::SCRAPE || RUNNING :: user: ${account.username}`)
            } else {
              console.log(`::SCRAPE || LIST ISSUE :: user: ${account.username}`)
              await Account.update({ scrape: true }, { where: { username: account.username } })
            }

          } else {
            //console.log('::RUNNING FOLLOW // UNFOLLOW::')
            // ----------------- RUN FOLLOW // UNFOLLOW BOT --------------------
            switch (account.timer) {
              case 1800: // (1800)
                  account.follow = !account.follow
                  account.timer = 0
              // case 800:
                //account.tag = true
              // case 400:
              // case 1000:
                //account.feed = true
                account.timer++
                break;
              default:
                account.timer++
            }
            await updateAccount(account)

            if (account.follow) {
              await follow(account)
            } else {
              await unfollow(account)
            }

            // if (account.tag) {
            //   //await callAPI(API.tag, account)
            //   account.tag = false
            // } else if (account.feed) {
            //   //await callAPI(API.feed, account)
            //   account.feed = false
            // }

          }
        }
        catch (err) {
          // console.log('Timer Error - could be a response timeout.') // Turned off because it was flagging 30 sec timeouts...
          // console.log(err)
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
