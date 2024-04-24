// Variable to store key's values
var result = [];
var obj = {};
var parent_key = "";
var arrayResults = [];

/**
 * Main function Entry that returns the result
 * @param {Object} object
 * @param {string} key
 * @returns {Array}
 */
export default function searchForKeys(object, key, keep_structure) {
  // Check for possible errors
  checkObjectForErrors(object);

  if (Array.isArray(object)) {
    findRecursiveInArray(object, key, keep_structure);
  } else {
    findRecursiveInObject(object, key, keep_structure);
  }

  if (Array.isArray(object)) {
    var arrayResultsToReturn = arrayResults;
    arrayResults = [];
    return arrayResultsToReturn;
  } else if (keep_structure) {
    var objToReturn = obj;
    obj = {};
    return objToReturn;
  } else {
    var arrayToReturn = result;
    result = [];
    return arrayToReturn;
  }
}

/**
 * Seach for the key in Object recursively
 * @param {Array} object
 * @param {string} key
 */
function findRecursiveInArray(array, key, keep_structure) {
  for (var i = 0; i < array.length; i++) {
    findRecursiveInObject(array[i], key, keep_structure);
    if (keep_structure) {
      arrayResults.push(obj);
      obj = {};
    } else {
      arrayResults.push(result);
      result = [];
    }
  }
}

/**
 * Seach for the key in Object recursively
 * @param {Object} object
 * @param {string} key
 */

function findRecursiveInObject(object, key, keep_structure) {
  for (var prop in object) {
    var temp = {};
    if (keep_structure && object[key] === object[prop]) {
      if (parent_key.split(".").length > 1) {
        var keys = parent_key.split(".");
        for (var i = keys.length - 1; i >= 0; i--) {
          if (i === keys.length - 1) {
            temp[keys[i]] = {};
            temp[keys[i]][prop] = object[prop];
          } else if (i === 0) {
            obj[keys[i]] = temp;
          } else {
            temp[keys[i]] = temp;
          }
        }
      } else {
        if (parent_key) {
          temp[prop] = object[prop];
          obj[parent_key] = temp;
        } else {
          obj[prop] = object[prop];
        }
      }
    } else if (object[key] === object[prop]) {
      result.push(object[prop]);
      parent_key = "";
    } else if (typeof object[prop] === "object") {
      // If nested object go deeper
      parent_key += parent_key ? "." + prop : prop;
      findRecursiveInObject(object[prop], key, keep_structure);
      parent_key = "";
    }
  }
}
/**
 * Check for possible errors in provided Object
 * @param {Object} object
 */

function checkObjectForErrors(object) {
  if (typeof object !== "object") {
    throw new Error("The variable is not an Object");
  } else if (object === undefined) {
    throw new Error("The variable is undefined");
  } else if (JSON.stringify(object) === "{}") {
    throw new Error("The variable is empty");
  }
}
