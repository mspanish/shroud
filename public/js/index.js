// like .split();
console.log(Array.from('Stacey'));

// wow cool way to adjust all values in an array or create new strings
console.log(Array.from('Stacey', letter => letter + 'dog'));

console.log(Array.from([0,2,3], letter => letter + '_dog'));

// easy way to get _.range()
console.log(Array.from({ length: 5  }, (val, key) => key)); // [0, 1, 2, 3]

// pre-populate array with the same value multiple  times
console.log(Array.from({ length: 4 }, () => 'jack')); // ['jack', 'jack']


// removing duplicates: appears there is NO END the cool stuff you can do with Array.from...

const duplicates = [1,2,3,4,4,1,98,202];
const uniqs = Array.from(new Set(duplicates));

console.table(uniqs)

// entries() used with SPREAD operator

let people = ['rick', 'brad', 'ben', 'stacey', 'julio'];
let entries = people.entries();
console.log([...entries]); // 

// find()

let numbers = [1, 2, 3];
let oddNumber = numbers.find(x => x % 2 == 1);
console.log(oddNumber); // 1

// let people = ['jamie', 'jack', 'isaac'];
// let jackIndex = people.findIndex(x => x === 'isaac');
// console.log(jackIndex); // 1

// repeat() for strings
let stacey = 'stacey';
console.log(stacey.repeat(3))

// drop fractions in number  Math.trunc()
console.log(Math.trunc(42.7)) // 42


// capitalize first letter of string
const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

for (let day of days) {
   console.log(day[0].toUpperCase() + day.slice(1))
};

// spread operator (notice how console logs elements not as an array)

const books = ["Don Quixote", "The Hobbit", "Alice in Wonderland", "Tale of Two Cities"];
console.log(...books);

// // spread operator to concat 2 arrays

const fruits = ["apples", "bananas", "pears"];
const vegetables = ["corn", "potatoes", "carrots"];
const produce =[...fruits, ...vegetables];
console.log(produce);

// // rest operator to throw a bunch of misc stuff into an a destructured objects/values
// // this is pretty awmazing - i mean you're creating a new array but also creating individual variables that can be referenced. Very powerful, can do lots of shiz with this

const names = ['stacey', 'ben', 'julio', 'rick', 'brad']
const dudes = [ tester, coder, expert, ...items ] = names;

console.log(dudes)
console.log(tester)
console.log(...items)

//rest for variadic fns  I indeed had no idea where the arguments object comes from in fns like these, so this will surely help me understand dis shiz

function sum(...nums) {
  let total = 0;  
  for(const num of nums) {
    total += num;
  }
  return total;
}

console.log(sum(1,6,3,6));


// find AVERAGE using rest operator

function average(...nums) {
    let total = 0;
    
    for (let num of nums) {
        total = total + num;       
    }
    return (total/nums.length) || 0;
}
console.log(average(2, 6));
/*
console.log(average(2, 3, 3, 5, 7, 10));
console.log(average(7, 1432, 12, 13, 100));
console.log(average());
*/