# Keys In Object

A Javascript library for retrieveing easy Object key's values.

## Installation

```
npm install keys-in-object
```

## How to use it

Node.js

```
var keysInObject = require('keys-in-object');

var users = {
	id_1: {
        name: 'John Doe',
        email: 'johndoe@test.com'
    },
	id_2: {
        name: 'Hohn Moe',
        email: 'hohnmoe@test.com'
    },
	id_3: {
        name: 'Joon Doo',
        email: 'joondoo@test.com'
    },
    id_4: {
        user_info: {
            name: 'Johnny Foe',
            email: 'johnnyfoe@test.com'
        }
    }
};

var arrayOfUserNames = keysInObject(users, 'name');
console.log(arrayOfUserNames)
// ['John Doe', 'Hohn Moe', 'Joon Doo', 'Johnny Foe']
```

Also you can pass an Array of Objects

```
var keysInObject = require('keys-in-object');

var user = {
	id_1: {
        name: 'John Doe',
        email: 'johndoe@test.com'
    },
	id_2: {
        name: 'Hohn Moe',
        email: 'hohnmoe@test.com'
    },
	id_3: {
        name: 'Joon Doo',
        email: 'joondoo@test.com'
    },
    id_4: {
        user_info: {
            name: 'Johnny Foe',
            email: 'johnnyfoe@test.com'
        }
    }
};

var usersArray = [user, user];
var arrayOfUserNames = keysInObject(usersArray, 'name');
console.log(arrayOfUserNames)
//[
      ['John Doe', 'Hohn Moe', 'Joon Doo', 'Johnny Foe'],
      ['John Doe', 'Hohn Moe', 'Joon Doo', 'Johnny Foe']
  ]
```

Browser

A build folder exists in keys-in-object under node_modules
Include the keysInObject.js file into your html script tags

```
<!doctype html>
<html>
    <head>
    </head>
    <body>
        <script src="./path to file/keysInObject.js"></script>
        <script>
            var users = {
	            id_1: {
                    name: 'John Doe',
                    email: 'johndoe@test.com'
                },
	            id_2: {
                    name: 'Hohn Moe',
                    email: 'hohnmoe@test.com'
                },
	            id_3: {
                    name: 'Joon Doo',
                    email: 'joondoo@test.com'
                },
                id_4: {
                    user_info: {
                        name: 'Johnny Foe',
                        email: 'johnnyfoe@test.com'
                    }
                }
            };

            var arrayOfUserNames = keysInObject(users, 'name');
            console.log(arrayOfUserNames)
        </script>
    </body>
</html>
```

## Additional feature

If you want to strip the unnecessary keys from the object and also to keep it's structure you can pass an optional Boolean Variable.

```
var userNames = keysInObject(users, 'name', true);
console.log(userNames)
/*
{
  id_1: {
    name: 'John Doe'
  },
  id_2: {
  	name: 'Hohn Moe'
  },
  id_3: {
  	name: 'Joon Doo'
  },
  id_4: {
    user_info: {
      name: 'Johnny Foe'
    }
  }
}
*/

// Or if you request for user_info
var userInfo = keysInObject(users, 'user_info', true);
console.log(userInfo)
/*
{
  id_4:{
    user_info: {
      name: 'Johnny Foe',
      email: 'johnnyfoe@test.com'
    }
  }
}
*/
```

## Tests

Simply clone the repo, npm install, and run npm test
