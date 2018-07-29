  Array.prototype.diff = function (a) {
    return this.filter(function (i) {
      return a.indexOf(i) < 0;
    });
  };
/*
  convertTimeformat(time) {
    var hours = Number(time.match(/^(\d+)/)[1]);
    var minutes = Number(time.match(/:(\d+)/)[1]);
    var  AMPM = time.match(/\s(.*)$/)[1];
    if (AMPM == "pm" && hours < 12) hours = hours + 12;
    if (AMPM == "am" && hours == 12) hours = hours - 12;
    var sHours = hours.toString();
    var sMinutes = minutes.toString();
    if (hours < 10) sHours = "0" + sHours;
    if (minutes < 10) sMinutes = "0" + sMinutes;
    return sHours + ":" + sMinutes;
  },
  shortenDates() {
    let dates = document.getElementsByClassName('date');
    let i = 0;
    for (let date of dates) {
  
      let el = date;
      date = date.textContent.toLowerCase();
      date = date.split(' ');
      let ml={
        'january': '01',
        'february': '02',
        'march': '03',
        'april': '04',
        'may': '05',
        'june': '06',
        'july': '07',
        'august': '08',
        'september': '09',
        'october': '10',
        'november': '11',
        'december': '12'
      }
      let minutes = date[4] + ' '+date[5];
      //let mins = this.convertTimeformat(minutes)
      let day = date[1].replace(',', '')
      if (day.length == 1) day = '0'+day;
      let str = date[2] + '-'+  ml[date[0]] + '-' + day;
      // +  ':'+mins;
      //str = new Date(str).toISOString();
      dates[i].innerHTML = '<span>'+ str + '</span><span class="right10">'+minutes+'</span>';
      i++;
    }
  }
  */

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