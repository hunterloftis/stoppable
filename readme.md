# Running locally

```
$ heroku local
```

# Deploying

```
$ heroku create
$ git push heroku master
$ heroku open # shows 'unnamed'

$ heroku config:set APP_NAME=MyName
$ heroku open # shows 'MyName'
```

# Linting

```
$ yarn run lint
```

(or *npm run lint* if you're using npm)
