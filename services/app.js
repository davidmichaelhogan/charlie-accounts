// ----------------------------------------------------------------------------------//
// Accounts API Lambda Function
// Charlie (( BETA v2.1 ))
// CRKS | May 20, 2018 | Updated: August 9, 2018
// ----------------------------------------------------------------------------------//

const serverless = require('serverless-http')
const request = require('request-promise')
const express = require('express')
const asyncHandler = require('express-async-handler')
const crypto = require('crypto')
const path = require('path');
const app = express()

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
  scrape:   `${URI}${STAGE}/scrape`,
  mail:     `${URI}${STAGE}/mail`
}

// DB bullshit
const Sequelize = require('sequelize')
const sequelize = new Sequelize(DB.database, DB.user, DB.pass, {
  host: DB.host,
  dialect: 'mysql',
  timezone: 'est',
  operatorsAliases: false,

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

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

app.use(express.json())

const encrypt = (text) => {
  let cipher = crypto.createCipher('aes-256-ctr', 'gd2814D')
  let crypted = cipher.update(text,'utf8','hex')
  crypted += cipher.final('hex')
  return crypted
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


const mids = {
  getAccounts: () => {
    return new Promise(async (resolve, reject) => {
      try {
        const accounts = await Account.findAll({ raw: true })
        resolve (accounts)
      }
      catch (error) {
        reject (error)
      }
    })
  },
  getAnalytics: () => {
    return new Promise(async (resolve, reject) => {
      try {
        const accounts = await Analytic.findAll({ raw: true })
        resolve (accounts)
      }
      catch (error) {
        reject (error)
      }
    })
  },
  updateAccount: (data) => {
    return new Promise(async (resolve, reject) => {
      try {
        await Account.update(data.send, { where: { username: data.username } })

        resolve ('Account updated.')
      }
      catch (error) {
        reject (error)
      }
    })
  },
  removeAccount: (data) => {
    return new Promise(async (resolve, reject) => {
      try {
        await Account.update({ enabled: false }, { where: { username: data.username } })

        resolve ('Account updated.')
      }
      catch (error) {
        reject (error)
      }
    })
  },
  createAccount: (data) => {
    return new Promise(async (resolve, reject) => {
      if (data.username.indexOf('@') > -1) {
        data.username = data.username.replace('@', '')
      }
      try {
        const exists = await Account.count({ where: { username: data.username } })
        if (exists) {
          await Account.destroy({ where: { username: data.username } })
        } else {
          if (data.trial) {
            await sendEmail(data.username, data.email, 0, 'trial_1')
          }
        }
        await Account.create({
          enabled: true,
          trial: data.trial,
          username: data.username,
          email: data.email,
          passphrase: encrypt(data.passphrase),
          accounts: data.accounts,
          region: REGION,
          timer: 1,
          follow: true,
          scrape: false
        })

        resolve ('Account created.')
      }
      catch (error) {
        reject (error)
      }
    })
  },
  addFollows: (data) => {
    return new Promise(async (resolve, reject) => {
      try {
        let addTimer = 0
        const currentArray = await Follow.findAll({ where: {username: data.username}, raw: true })
        const currentAccounts = currentArray.map((obj) => obj.account)
        const insertArray = data.accounts.map(async (account) => {
          if (currentAccounts.indexOf(account) === -1) {
            await Follow.create({
              username: data.username,
              parent: data.parent,
              account: account
            })
            addTimer++
          }
        })

        await Promise.all(insertArray)
        console.log(addTimer + ' accounts added.')
        resolve('Accounts added.')
      }
      catch (err) {
        console.log(err)
      }
    })
  },
  addAnalytics: (data) => {
    return new Promise(async (resolve, reject) => {
      try {
        // const exists = await Analytic.count({ where: { username: data.username } })
        // if (exists) {
        //   await Analytic.update({followers: data.followers, following: data.following}, { where: { username: data.username } })
        // } else {
          await Analytic.create({
            username: data.username,
            followers: data.followers,
            following: data.following
          })
        // }
        resolve('Analytics added.')
      }
      catch (err) {
        console.log(err)
      }
    })
  }
}

app.get('/', asyncHandler(async (req, res, next) => {
  res.send('CHARLIE API')
}))

app.post('/new', asyncHandler(async (req, res, next) => {
  const data = req.body
  console.log(data)

  const message = await mids.createAccount(data)
  res.send(message)
}))

app.post('/update', asyncHandler(async (req, res, next) => {
  const data = req.body

  const message = await mids.updateAccount(data)
  res.send(message)
}))

app.post('/addfollows', asyncHandler(async (req, res, next) => {
  const data = req.body

  const message = await mids.addFollows(data)
  res.send(message)
}))

app.post('/addanalytics', asyncHandler(async (req, res, next) => {
  const data = req.body

  const message = await mids.addAnalytics(data)
  res.send(message)
}))

app.post('/remove', asyncHandler(async (req, res, next) => {
  const data = req.body

  const message = await mids.removeAccount(data)
  res.send(message)
}))

app.get('/accounts', asyncHandler(async (req, res, next) => {

  const data = await mids.getAccounts()
  res.send(data)
}))

app.get('/analytics', asyncHandler(async (req, res, next) => {

  const data = await mids.getAnalytics()
  res.send(data)
}))

module.exports.handler = serverless(app)
//app.listen(3000, () => console.log('Listening on port 3000!'))
