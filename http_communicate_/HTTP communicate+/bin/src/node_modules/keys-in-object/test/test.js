const keysInObject = require("../build/keysInObject");
const assert = require("assert");

const users = {
  id_1: {
    name: "John Doe",
    email: "johndoe@test.com",
  },
  id_2: {
    name: "Hohn Moe",
    email: "hohnmoe@test.com",
  },
  id_3: {
    name: "Joon Doo",
    email: "joondoo@test.com",
  },
  id_4: {
    user_info: {
      name: "Johnny Foe",
      email: "johnnyfoe@test.com",
    },
  },
};

describe("keysInObject", function () {
  describe("Functionalities", function () {
    it('should return Array with nested object of "id_1"', function () {
      assert.deepEqual(keysInObject(users, "id_1"), [
        {
          name: "John Doe",
          email: "johndoe@test.com",
        },
      ]);
    });

    it('should return Array with values object of "name" key', function () {
      assert.deepEqual(keysInObject(users, "name"), [
        "John Doe",
        "Hohn Moe",
        "Joon Doo",
        "Johnny Foe",
      ]);
    });

    it('should return Array with length "4" for "name" key', function () {
      assert.equal(keysInObject(users, "name").length, 4);
    });

    it("should return empty Array for non existance key", function () {
      assert.deepEqual(keysInObject(users, "id_5"), []);
    });

    it("should return id_1 values keeping the object structure", function () {
      assert.deepEqual(keysInObject(users, "id_1", true), {
        id_1: {
          name: "John Doe",
          email: "johndoe@test.com",
        },
      });
    });

    it("should return id_4 user_info object values keeping the structure", function () {
      assert.deepEqual(keysInObject(users, "user_info", true), {
        id_4: {
          user_info: {
            name: "Johnny Foe",
            email: "johnnyfoe@test.com",
          },
        },
      });
    });

    it("should keep object structure obtaining only the required key", function () {
      assert.deepEqual(keysInObject(users, "name", true), {
        id_1: {
          name: "John Doe",
        },
        id_2: {
          name: "Hohn Moe",
        },
        id_3: {
          name: "Joon Doo",
        },
        id_4: {
          user_info: {
            name: "Johnny Foe",
          },
        },
      });
    });

    it('should accept array of objects and return Array of Array with values object of "name" key', function () {
      var usersArray = [users, users];
      assert.deepEqual(keysInObject(usersArray, "name"), [
        ["John Doe", "Hohn Moe", "Joon Doo", "Johnny Foe"],
        ["John Doe", "Hohn Moe", "Joon Doo", "Johnny Foe"],
      ]);
    });

    it("should accept array of objects keeping the object structure", function () {
      var usersArray = [users, users];
      assert.deepEqual(keysInObject(usersArray, "name", true), [
        {
          id_1: {
            name: "John Doe",
          },
          id_2: {
            name: "Hohn Moe",
          },
          id_3: {
            name: "Joon Doo",
          },
          id_4: {
            user_info: {
              name: "Johnny Foe",
            },
          },
        },
        {
          id_1: {
            name: "John Doe",
          },
          id_2: {
            name: "Hohn Moe",
          },
          id_3: {
            name: "Joon Doo",
          },
          id_4: {
            user_info: {
              name: "Johnny Foe",
            },
          },
        },
      ]);
    });
  });

  describe("Errors", function () {
    it("should throw an Error when NOT passing Object", function () {
      const results = function () {
        keysInObject(2, "any");
      };
      assert.throws(results, Error, "The variable is not an Object");
    });

    it("should throw an Error when passing Undefined", function () {
      const results = function () {
        keysInObject(undefined, "any");
      };
      assert.throws(results, Error, "The variable is undefined");
    });

    it("should throw an Error when passing Empty Object", function () {
      const results = function () {
        keysInObject({}, "any");
      };
      assert.throws(results, Error, "The variable is empty");
    });
  });
});
