  import { Toast, deleteAllToasts } from './toaster-js/index.js'; 

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
  const saveToNotebook = (type,cat,post, x, postid) => {
 /* for entries coming from modal button click, they only have a postid - so we have to 'get'
 the rest, i've hijacked the x var for that! They had to have clicked this from our notebook page,
 so it's already transferred from localStorage to our store */
    if (x == 'get') {
     // console.log('postid is '+postid)
      let bms = localStorage.getItem('bookmarks');
      bms = JSON.parse(bms);
      let bm = bms[postid]
      cat = bm.cat
      post = bm;
      //console.log('got your modal click, bm is '+JSON.stringify(bm))
    }

    let str = cat;
    // new Toast(str, 'modal','error', 0,[
    // 		{ text:'ok', action:'cancel'}])
    // 		return
    /* the x ties us to the index, which I don't like, but I don't see any other way right now
    as there are no unique ids accross the 3 blogs - stephen jones has no ids for comments. So basically this is lame and we can now only hide crap we may want to delete later, because it would screw up the index for everything saved to notebook
    */
    let bookmarks = localStorage.getItem('bookmarks') || {};
    if (Object.keys(bookmarks).length > 0) bookmarks = JSON.parse(bookmarks);

    //console.log(x+ ' cat is '+cat)
    //console.log(x+ ' author is '+post.author)

    /* if we're adjusting from notebook we already have an id, if we are adding from a comment then we need to create one */
    let id = postid;

    if (!postid) {
      id = `${post.author}_${cat}_${x}`
    }

    let st;
    
    let obj = {
      commentid: post.id,
      id: id,
      cat: cat,
      title: post.title,
      post: post.post,
      author: post.author,
      url: post.url,
      date:post.date,
      updated: Date.now()
    }
    
    if (bookmarks[id] && bookmarks[id].note) obj.note = bookmarks[id].note;

    switch (type) {
      case 'pro':
        obj.type = 'pro';				
        bookmarks[id] = obj;
        localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
         st = 'saved '+post.title+ ' to notebook as supporting authenticity.'
         bookmarks = Object.entries(bookmarks);
      //sorting here is confusing, leave as is
         store.set({bookmarks: bookmarks})
        new Toast(st,'toast','success')
        setTimeout(() => {
          deleteAllToasts();
        }, 500);
        break;
      case 'con':
        obj.type = 'con';				
        bookmarks[id] = obj;
        localStorage.setItem('bookmarks', JSON.stringify(bookmarks));	
        bookmarks = Object.entries(bookmarks);
   
        store.set({bookmarks: bookmarks})				
        st = 'saved '+post.title+ ' to notebook as evidence against authenticity.'
        new Toast(st,'toast','error')
        setTimeout(() => {
          deleteAllToasts();
        }, 500);
        break;			

      case 'note':
          if (post.type) obj.type = post.type;
          st = 'Enter or paste text:';
          store.set({temp:obj})
        new Toast(str, 'modal', 'input', 0, [], 'note');
        break;
    }

  }

  const addParagraphBreaks = (post) => {
    let comp = this;
  //	let postings = document.getElementsByClassName('posting');
    //console.log('got postings? '+postings)
    let j = 0;

    const authorsArr  = ['david', 'hugh', 'dan', 'colin', 'yannick', 'charles', 'daveb', 'max', 'stephen', 'mario', 'mark', 'antonio', 'john', 'giulio', 'louis', 'anoxie', 'dave', 'kelly', 'barry', 'barrie', 'russ', 'joe', 'colinsberry', 'ron'];
    const scholars = ['barbet','rucker','zugibe', 'wesselow', 'piczak', 'piczek', 'benford','vignon', 'bucklin', 'marino','rolfe', 'meacham', 'fanti', 'rogers', 'adler', 'heller', 'mccrone', 'jackson', 'strup', 'enea']
    const shroudWords = ['pray', 'codex', 'tomb', 'cloth', 'textile', 'shroud', 'woven', 'ancient', 'formation', 'pollen', 'dna']
    const bloodWords = ['blood', 'bloodstains', 'bloodstain', 'bloody', 'wounds'];
    const holyWords = ['christ', 'yeshua','jesus', 'god', 'holy', 'spirit', 'trinity', 'lord', 'lords']
    return alterPost(post);
    
    
    function alterPost(str) { 
      //console.log('altering: '+str)
    //	if (j > postings.length-1) return
//			for (let posting of postings) {

    //	let str = post  // postings[j].textContent.replace(/\\n/g, '');
      //console.log(str)
    
      let arr = [];

      let words = str.split(' ');
    
      //let result = this.chunkArray(str, 50);
      let newStr = '';
      let lines = [];

      let i = 0; // for lines
      let e = 0; // for words
      let z = 0;
  
      
      for (let word of words) {
        // fix people like Charles Freeman who are always adding commas w/ no space after them...
        word = word.replace(/,[s]*/g, ", ");

        let line = lines[i] || '';	
        //console.log(word)
        if (authorsArr.includes(word.trim().toLowerCase().replace('-','').replace('“', '').replace(',', '').replace('.', ''))) {
          word = '<span class="authorName">'+word+'</span>';
        }
        if (scholars.includes(word.trim().toLowerCase().replace('“', '').replace('’s', '').replace(',', '').replace('.', ''))) {
          word = '<span class="scholars">'+word+'</span>';
        }


        if (bloodWords.includes(word.trim().toLowerCase().replace('“', '').replace(',', '').replace('.', ''))) {
          word = '<span class="blood">'+word+'</span>';
        }

        if (shroudWords.includes(word.trim().toLowerCase().replace('“', '').replace(',', '').replace('.', ''))) {
          word = '<span class="shroud">'+word+'</span>';
        }

        if (holyWords.includes(word.trim().toLowerCase().replace('“', '').replace(',', '').replace('.', '').replace('’s', ''))) {
          word = '<span class="holy">'+word+'</span>';
        }				

        line = line + ' ' + word;
        lines[i] = line;
        e++
        if (e > 50 && word.includes('.') || e > 50 && word.includes('!')) {
          e = 0;
          //console.log("\n\nGOT A HIT")
          i++;
        }
      }
      for (let line of lines) {
        //console.log(line)
        line = urlify(line);
        newStr = newStr + '<p>'+line+'</p>'
      }
      return newStr;
    //	postings[j].innerHTML =  newStr;
    //	j++
      
      // setTimeout(() => {
      // 	alterPost(j);
      // }, 50);
    
    }
  };

  const urlify = (text) => {
    let urlRegex = /(((https?:\/\/)|(www\.))[^\s]+)/g;
    //var urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlRegex, function(url,b,c) {
    
    let url2 = (c == 'www.') ?  'http://' +url : url;
      url2 = url2.replace(')', '').replace('(', '')
    
      return '<a href="' +url2.toLowerCase()+ '" target="_blank">' + url.toLowerCase() + '</a>';
    }) 
  };
  const chunkArray = (myArray, chunk_size) =>{
    var index = 0;
    var arrayLength = myArray.length;
    var tempArray = [];

    for (let index = 0; index < arrayLength; index += chunk_size) {
  
      let myChunk = myArray.slice(index, index+chunk_size);
      // Do something if you want with the group
      
      tempArray.push(myChunk);
    }

    return tempArray;
  };

  const parseSubCats = (json) => {
    for (let key in json) {
      let obj = json[key].subdirs;
      if (obj && Object.keys(obj).length > 0) {
        // make into an arry so we can load into svelte
        json[key].subdirs = Object.entries(obj);
       // console.log(JSON.stringify(json[key].subdirs))
      }
    }  
    return Object.entries(json);
  }

  var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

  // this is cool, it reverses Object.entries()
  const objectify = (arr) => {
   return arr.map(([key, val]) => ([key, val])).reduce((obj, [k, v]) => Object.assign(obj, { [k]: v }), {})
  }

export {getRandomWord, startCase, saveToNotebook, urlify, addParagraphBreaks, parseSubCats, objectify }