# Quickly start new Node.js projects on Heroku

```
$ git clone https://github.com/hunterloftis/heroku-node-template.git foo
$ cd foo
```

# (optional) .bash_profile script

```
# Easy init of new node projects
heroku-node() {
  git clone https://github.com/hunterloftis/heroku-node-template.git "$1"
}
```

To use:

```
$ heroku-node projectname
```

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
