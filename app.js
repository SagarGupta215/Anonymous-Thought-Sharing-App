//jshint esversion:6
require('dotenv').config();
const express = require("express");
const bodyParser = require('body-parser');
const ejs = require('ejs');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate');

// const bcrypt = require('bcrypt');
// const saltRounds = 10;
// const encrypt = require("mongoose-encryption");
// const md5 = require('md5');
const app = express();

app.use(express.static("public"));
app.use(bodyParser.urlencoded({extended:true}));
app.set('view engine', 'ejs');
app.use(session({
    secret:process.env.SECRET,
    resave:false,
    saveUninitialized:false
}));
app.use(passport.initialize());
app.use(passport.session());

mongoose.connect(process.env.DATABASE_URI, { useNewUrlParser: true }).then(function (res) {
    console.log('Connected to Database');
}).catch(function (err) {
    console.log(err);
});

const userSchema = new mongoose.Schema({
    email:String,
    password:String,
    googleId:String,
    secret:String
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

// const secret = "Thisisourlittlesecret.";
// userSchema.plugin(encrypt,{secret:process.env.SECRET,encryptedFields:["password"]});

const User = mongoose.model("User",userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, cb) {
    process.nextTick(function() {
      return cb(null, {
        id: user.id,
        username:user.username
      });
    });
  });
  
  passport.deserializeUser(function(user, cb) {
    process.nextTick(function() {
      return cb(null, user);
    });
  });

passport.use(new GoogleStrategy({
    clientID:process.env.CLIENT_ID,
    clientSecret:process.env.CLIENT_SECRET,
    callbackURL: "https://localhost:3000/auth/google/secrets",
    userProfileURL:"http://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
    console.log(profile);
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

app.get("/" , function(req,res){
    res.render("home");
});

app.get("/login" , function(req,res){
    res.render("login");
});

app.get("/register" , function(req,res){
    res.render("register");
});

app.get("/secrets",function(req,res){
    User.find({"secret":{$ne:null}}).then(function(foundUser){
        res.render("secrets",{usersWithSecrets:foundUser});
    }).catch(function(err){
        console.log(err);
    })
});

app.get("/logout", function(req,res){
    req.logOut(function(err){
        if(err){
            console.log(err);
        }
    });
    res.redirect("/");
});

app.get("/auth/google",
    passport.authenticate("google",{scope:['profile']
}));    


app.get("/auth/google/secrets",passport.authenticate("google",{
    successRedirect:"/secrets",
    failureRedirect:"/login"
}));

app.post('/logout', function(req, res, next){
    req.logout(function(err) {
      if (err) { return next(err); }
      res.redirect('/');
    });
  });

app.post("/login" , function(req,res){
    // const username = req.body.username;
    // const password = req.body.password;
    // User.findOne({email:username}).then(function(foundUser){
    //     if(foundUser){
    //         bcrypt.compare(password,foundUser.password).then(function(result){
    //             res.render('secrets');
    //         }).catch(function(err){
    //             console.log(err);
    //         });
    //     } else {
    //         console.log("wrong password or username");    
    //     }
    // }).catch(function(err){
    //     console.log(err);
    // });
    // <--- passport ka code --->
    const user = new User({
        username:req.body.username,
        password:req.body.password
    });
    req.logIn(user,function(err){
        if(err){
            console.log(err);
        }else{
            passport.authenticate("local")(req,res,function(){
                res.redirect("/secrets");
            })
        }
    });

});

app.post("/register",function(req,res){
    // bcrypt.hash(req.body.password,saltRounds).then(function(hash){
    //     const newUser = new User({
    //         email : req.body.username,
    //         password : hash      
    //     });
    //     newUser.save().then(function(){
    //         res.render("secrets");
    //     }).catch(function(err){
    //         console.log(err);
    //     });

    // }).catch(function(err){
    //     console.log(err);
    // });

    //<--- passport.js ka code ---->
    User.register({username:req.body.username},req.body.password).then(function(){
        passport.authenticate("local")(req,res,function(){
            res.redirect("/secrets");
        });
    }).catch(function(err){
        console.log(err);
    });
    
    
});
 
app.get("/submit",function(req,res){
    if(req.isAuthenticated()){
        res.render("submit");
    }else{
        res.redirect("/login");
    }
});
app.post("/submit",function(req,res){
    const submittedSecret = req.body.secret;
    User.findById(req.user.id).then(function(foundUser){
        foundUser.secret = submittedSecret;
        foundUser.save().then(function(){
            res.redirect("/secrets");
        }).catch(function(err){
            console.log(err);
        })
    }).catch(function(err){
        console.log(err);
    })

})

app.listen(3000 , function(){
    console.log("Server started at port no 3000");
});