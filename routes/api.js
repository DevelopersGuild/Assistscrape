/**
* Current list of errors:
*
* UCDSVM/SVM.PREREQ/classes -> No Boxes
* CSUSB/LBST BA GT/classes -> Notes outside of course box (ie. Select one from the following.)
* UCLA/COM STD/classes -> Notes within course box with no course (ie. Three additional courses from)
*
*/

var express = require('express');
var fs      = require('fs');
var request = require('request');
var cheerio = require('cheerio');
var url     = require('url');
var app     = express.Router();

var conjunctions =
{
  andEither : ' AND EITHER ',
  or        : ' OR ',
  and       : ' AND ',
  amp       : ' & '
};

var notArticulated  =
[
  'no course articulated',
  'not articulated',
  'no comparable lab',
  'no comparable courses',
  'this course is never articulated'
];

// Displays the schools available to transfer to from De Anza College.
function getSchools(req, res)
{
  var url = 'http://www.assist.org/web-assist/DAC.html';

  request(url, function(error, response, html)
  {
    if(!error)
    {
      var $ = cheerio.load(html);
      var schools = [];

      $('option').each(function(i, elem)
      {
        if($(this).parent().attr('id') == 'oia' && i != 188)
        {
          var school = $(this).text();
          school = school.replace('To:', '').trim();
          var value = $(this).attr('value');
          var url = require("url");
          value = url.parse(value, true).query.oia;
          schools.push( { school: school, value: value} );
        }
      });

      res.send(JSON.stringify(schools));
    }
    else
    {
      res.send(JSON.stringify(
      {
        error: "Error with parsing"
      }));
    }
  });
}

// Displays the majors available at the transfer school.
function getMajors(req, res)
{
  var school = req.params.school;
  var url = 'http://www.assist.org/web-assist/articulationAgreement.do?inst1=none&inst2=none&ia=DAC&ay=15-16&oia='+school+'&dir=1';

  request(url, function(error, response, html)
  {
    if(!error)
    {
      var $ = cheerio.load(html);
      var majors = [];

      $('#title').each(function(i, elem)
      {
        if($(this).text().indexOf("By Major") > -1 &&
          $(this).text().indexOf("Not Available") > -1)
        {
          res.send(JSON.stringify(
          {
            error: "Major not available for this school"
          }));
        }
      });

      $('option').each(function(i , elem)
      {
        if($(this).parent().parent().attr('name') == 'major' &&
          $(this).parent().attr('name') == 'dora' &&
          $(this).attr('value').length > 0 &&
          $(this).attr('value') != '-1')
        {
          var dora = $(this).text();
          var value = $(this).attr('value');
          majors.push( { major: dora, value: value });
        }
      });

      for(var z = 0; z < majors.length; z++)
      {
        majors[z].value = majors[z].value.replace('/','*');
      }

      if(majors.length > 0)
      {
        res.send(JSON.stringify(majors));
      }
      else
      {
        res.send(JSON.stringify(
        {
          error: "Error with school name"
        }));
      }
    }
    else
    {
      res.send(JSON.stringify(
      {
        error: "Error with school name"
      }));
    }
  });
}

// Displays the courses at De Anza College and its articulated course at transfer school.
function getClasses(req, res)
{
  var school = req.params.school;
  var dora = req.params.dora;
  dora = dora.replace('*','%2F');

  // Get the aay value.
  var url = 'http://www.assist.org/web-assist/articulationAgreement.do?inst1=none&inst2=none&ia=DAC&ay=15-16&oia='+school+'&dir=1';
  request(url, function(error, response, html)
  {
    if(!error)
    {
      var aay = getAay(html);

      // Get the iframe.
      var url2 = 'http://www.assist.org/web-assist/report.do?agreement=aa&reportPath=REPORT_2&reportScript=Rep2.pl&event=19&dir=1&sia=DAC&ria='+school+'&ia=DAC&oia='+school+'&aay='+aay+'&ay=15-16&dora='+dora;
      request(url2, function(error, response, html)
      {
        if(!error)
        {
          var url3 = getIframe(html);

          // The iframe data.
          request(url3, function(error, response, html)
          {
            if(!error){
              var $ = cheerio.load(html);
              var text = $('body').text();
              res.send(
              {
                "data": getCourses(text)
              });
            }
            else
            {
              res.send(JSON.stringify(
              {
                error: "Error with major name"
              }));
            }
          });
        }
        else
        {
          res.send(JSON.stringify(
          {
            error: "Error with school name"
          }));
        }
      });
    }
  });
}

function getAay(html)
{
  var aay = '15-16';
  var $ = cheerio.load(html);

  $('input').each(function(i, elem)
  {
    if($(this).parent().attr('name') == 'major' &&
      $(this).attr('name') == 'aay')
    {
      aay = $(this).attr('value');
    }
  });

  return aay;
}

function getIframe(html)
{
  var url;
  var $ = cheerio.load(html);

  $('iframe').each(function(i, elem)
  {
    url = $(this).attr('src');
  });

  return url;
}

function getCourses(text)
{
  text = text.replace(/  +/g, ' ');
  var result = [];
  var from = true;
  var fromCourse = '';
  var toCourse = '';
  var courses = [];

  // Splits the text into course boxes.
  courses = text.match(/---([^-]+)\|([^-]+)---/g);

  // Split each box into from and to.
  courses.forEach(function(course)
  {
    course = course.slice(3, -3);
    for (var i = 0; i < course.length; ++i)
    {
      if (course[i] == '|' || course[i] == '\n')
      {
        toCourse += '\n';
        fromCourse += '\n';
        from = !from;
      }
      else if (!from)
      {
        toCourse += course[i];
      }
      else if (from)
      {
        fromCourse += course[i];
      }
    }
    result.push({ toCourse: parseCourse(toCourse), fromCourse: parseCourse(fromCourse) });
    toCourse = '';
    fromCourse = '';
    from = !from;
  });
  return result;
}

function parseCourse(text)
{
  // Splits each course using the units as a marker for the starting line.
  // Conjunction is for course after current.
  var courses = text.replace(/(\(\d+\.?\d*\).|\n*)(^.*\(\d+\.?\d*\))/mg, '$1|$2')
    .replace(/\s\s+/g, ' ')
    .trim()
    .split('|')
    .filter(function(course)
    {
      return course !== '' && course !== '\n';
    });

  courses.forEach(function(elem, i, arr)
  {
    // Move & to end of line.
    var re = new RegExp('(.*)' + conjunctions.amp + '(.*?\\\(\\\d+\.?\\\d*\\\).*)');
    arr[i] = elem.replace(re, '$1 $2' + conjunctions.amp + conjunctions.amp);
  });

  return conjunctionSplit(courses);
}

function conjunctionSplit(array)
{
  var result = [];
  var line = array.join(' ');

  if (line.indexOf(conjunctions.andEither) > -1)
  {
    // More complicated...
  }
  else if (line.indexOf(conjunctions.and) > -1)
  {
    result.push({ and: getAndSplitted(line) });
  }
  else if (line.indexOf(conjunctions.or) > -1)
  {
    result.push({ or: getOrSplitted(line) });
  }
  else if (line.indexOf(conjunctions.amp) > -1)
  {
    result.push({ amp: getAmpSplitted(line) });
  }
  else
  {
    result.push(parseCourseData(line));
  }
  return result;
}

function getAndSplitted(line)
{
  var result = [];
  var andSplitted = line.split(conjunctions.and);
  andSplitted.forEach(function(elem)
  {
    if (elem.indexOf(conjunctions.or) > -1)
    {
      result.push({ or: getOrSplitted(elem) });
    }
    else if (elem.indexOf(conjunctions.amp) > -1)
    {
      result.push({ amp: getAmpSplitted(elem) });
    }
    else
    {
      result.push(parseCourseData(elem));
    }
  });
  return result;
}

function getOrSplitted(line)
{
  var result = [];
  var orSplitted = line.split(conjunctions.or);
  orSplitted.forEach(function(elem)
  {
    if (elem.indexOf(conjunctions.amp) > -1)
    {
      result.push({ amp: getAmpSplitted(elem) });
    }
    else
    {
      result.push(parseCourseData(elem));
    }
  });
  return result;
}

function getAmpSplitted(line)
{
  var result = [];
  var ampSplitted = line.split(conjunctions.amp + conjunctions.amp);
  ampSplitted.forEach(function(elem)
  {
    result.push(parseCourseData(elem));
  });
  return result;
}

function parseCourseData(line)
{
  // If course not articulated, result is empty.
  for (var j = 0; j < notArticulated.length; ++j)
  {
    if (line.toLowerCase().indexOf(notArticulated[j]) > -1)
    {
      return;
    }
  }

  var unit = line.match(/\(\d+\.?\d*\)/);
  var code = line.replace(/(^.+?[0-9]+.*?)\s.+/, '$1');
  var title;
  if (unit)
  {
    unit = unit[0];

    title = line.replace(unit, '')
      .replace(code, '')
      .replace(/\s\s+/g, ' ')
      .trim();
    unit = unit.slice(1, -1).trim();
    code = code.replace(/\s\s+/g, ' ').trim();
  }

  return { code: code, title: title, unit: unit };
}

app.get('/schools', getSchools);
app.get('/:school/majors', getMajors);
app.get('/:school/:dora/classes', getClasses);

module.exports = app;