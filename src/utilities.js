  Array.prototype.diff = function (a) {
    return this.filter(function (i) {
      return a.indexOf(i) < 0;
    });
  };

  const getRandomInt = (min, max) => {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min)) + min; //The maximum is exclusive and the minimum is inclusive
  }

  const getRandomWord = (num) => {
    let str = '';
    let i = 0;
    while (i < num)  {
      let rand = getRandomInt(0,25) 
      let letters = Array.from('abcdefghijklmnopqrstuvwxyz');
      let letter = letters[rand];
      str = str + letter;
      i++;
    }
    return str
  }
  const startCase = (str) => {
    return str.split(' ')
    .map(w => w[0].toUpperCase() + w.substr(1).toLowerCase())
    .join(' ');	
  }
  
  export {getRandomWord, startCase}