const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const shortid = require('shortid')
const moment = require('moment')

const cors = require('cors')

const mongoose = require('mongoose')
mongoose.connect(process.env.DB_URI)

var userSchema = new mongoose.Schema({
  _id: {
    'type': String,
    'default': shortid.generate
  },
  username: {
    type: String,
    required: true
  }
}, {
  toJSON: { virtuals: true }
});

userSchema.virtual('log', {
    ref: 'UserExcercise',
    localField: '_id',
    foreignField: 'userId'
})

userSchema.virtual('count', {
    ref: 'UserExcercise',
    localField: '_id',
    foreignField: 'userId',
    count: true
})

userSchema.methods.toJSON = function () {
    const user = this
    const userObject = user.toObject({ virtuals: true })
    delete userObject.__v
    delete userObject.id
    return userObject
}

var User = mongoose.model('User', userSchema);


var userExcerciseSchema = new mongoose.Schema({
    description: {
        type: String,
        required: true
    },
    duration: {
        type: Number
    },
    userId: {
        type: String,
        required: true,
        ref: 'User'
    },
    date: {
      type: Date,
      default: new Date()
    }
}, {
  toJSON: { virtuals: true }
});

userExcerciseSchema.methods.toJSON = function () {
    const userExcercise = this
    const userObject = userExcercise.toObject()
    delete userObject.__v
    delete userObject._id
    return userObject
}

var UserExcercise = mongoose.model('UserExcercise', userExcerciseSchema);


app.use(cors())

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())


app.use(express.static('public'))

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

app.post('/api/exercise/new-user', async (req, res) => {
    const user = new User(req.body)
    try{
      await user.save()
      return res.status(201).json(user) 
    }catch(e){
      return res.status(400).json(e) 
    }
})

app.get('/api/exercise/users', async (req, res) => {
  const users = await User.find()
  res.json(users)
})

app.post('/api/exercise/add', async (req, res) => {
    const user = await User.findById(req.body.userId).lean()
    const excercise = new UserExcercise({
      ...req.body
    })
    
    try{
      await excercise.save()
      const resObject = {
        ...user,
        "description": excercise.description,
        "duration": excercise.duration,
        "date": moment(excercise.date).format('ddd MMM DD YYYY')
      }
      
      delete resObject.__v
      
      return res.status(201).send(resObject) 
    }catch(e){
      return res.status(400).json(e) 
    }
})

app.get('/api/exercise/log', async (req, res) => {
  if (!req.query.userId){
    return res.status(400).send()
  }
  
  let user = await User.findOne({_id:req.query.userId})
  if (!user){
    return res.status(400).send()
  }
  
  let match = {
    date: {}
  }

  if (req.query.from && new Date(req.query.from).toString() !== "Invalid Date") {
      match.date = {
        ...match.date,
        $gte: new Date(req.query.from)
      }
  }
  
  if (req.query.to && new Date(req.query.to).toString() !== "Invalid Date") {
      match.date = {
        ...match.date,
        $lte: new Date(req.query.to)
      }
  }
  
  if (!match.date.$gte && !match.date.$lte){
    match = undefined
  }

  try {
      await user.populate({
          path: 'log',
          match,
          options: {
              limit: parseInt(req.query.limit)
          }
      }).execPopulate()
    
      await user.populate({
          path: 'count',
          match,
          options: {
              limit: parseInt(req.query.limit)
          }
      }).execPopulate()
    
      res.send(user)
  } catch (e) {
      res.status(400).send(e)
  }
})

// Not found middleware
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'})
})

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
})

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
