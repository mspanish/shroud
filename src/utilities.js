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
        break;
      case 'con':
        obj.type = 'con';				
        bookmarks[id] = obj;
        localStorage.setItem('bookmarks', JSON.stringify(bookmarks));	
        bookmarks = Object.entries(bookmarks);
   
        store.set({bookmarks: bookmarks})				
        st = 'saved '+post.title+ ' to notebook as evidence against authenticity.'
        new Toast(st,'toast','error')
        break;			

      case 'note':
          if (post.type) obj.type = post.type;
          st = 'Enter or paste text:';
          store.set({temp:obj})
        new Toast(str, 'modal', 'input', 0, [], 'note');
        break;
    }
    setTimeout(() => {
      deleteAllToasts();
    }, 500);
  }
  export {getRandomWord, startCase, saveToNotebook}