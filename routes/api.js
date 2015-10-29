/**
* Current list of errors:
*
* UCDSVM/SVM.PREREQ/classes -> No Boxes
* CSUSB/LBST BA GT/classes -> Courses missing
*
* To Do:
*
* Callbacks for get_all functions
*/

var express = require('express');
var fs      = require('fs');
var request = require('request');
var cheerio = require('cheerio');
var url     = require('url');
var app     = express.Router();

// Conjunctions that are found within a course box.
var conjunctions =
{
  andEither : ' AND EITHER ',
  or        : ' OR ',
  and       : ' AND ',
  amp       : ' & '
};


function get_all_ias(req, res)
{
    var url = 'http://www.assist.org/web-assist/welcome.html';
    request(url, function(error, response, html)
    {
      if (!error)
      {
        var $ = cheerio.load(html);
        var ias = [];

        $('option').each(function(i)
        {

          // Index i === 0 is default value.
          if($(this).parent().attr('name') == 'ia' && i !== 0)
          {
            var ia = $(this).text();

            // Get rid of .html extension.
            var value = $(this).attr('value')
              .slice(0, -5);
            ias.push( { name: ia, value: value });
          }
        });
        res.send(JSON.stringify(ias));
      }
      else
      {
          var error = "Error with parsing.";
          res.send(JSON.stringify(error));
      }
    });
}
/**~*~*
  Gets the list of available institutions.
*~**/
function get_ias(req, res)
{
    get_all_ias(req, res);
}

/**~*~*
  Gets the list of transferable institutions from the selected institution.
*~**/
function get_oias(req, res)
{
  var ia = req.params.ia;
  get_all_oias(req, res, ia);
}

function get_all_oias(req, res, ia)
{
    var url = 'http://www.assist.org/web-assist/'+ia+'.html';

    request(url, function(error, response, html)
    {
      if (!error)
      {
        var $ = cheerio.load(html);
        var oias = [];

        $('option').each(function(i)
        {
          if($(this).parent().attr('id') == 'oia' && i != 188)
          {
            var oia = $(this).text();
            if (oia.indexOf('To:') > -1)
            {
              // Some oias have a 'From' field which modifies the ia property of the URL.
              oia = oia.replace('To:', '').trim();

              // Grab only the oia property of the URL in value.
              var value = $(this).attr('value');
              var url = require("url");
              value = url.parse(value, true).query.oia;
              oias.push( { name: oia, value: value} );
            }
          }
        });
        res.send(JSON.stringify(oias));
      }
      else
      {
          var error = "Error with parsing.";
          res.send(JSON.stringify(err));
      }
    });
}

/**~*~*
  Gets the majors available at oia.
*~**/
function get_doras(req, res)
{
  var ia = req.params.ia;
  var oia = req.params.oia;

  get_all_dora(req, res, ia, oia);
}

function get_all_dora(req, res, ia, oia)
{
    var url = 'http://www.assist.org/web-assist/articulationAgreement.do?inst1=none&inst2=none&ia='+ia+'&ay=15-16&oia='+oia+'&dir=1';

    request(url, function(error, response, html)
    {
      if (!error)
      {
        var $ = cheerio.load(html);
        var majors = [];

        $('#title').each(function()
        {
          if($(this).text().indexOf("By Major") > -1 &&
            $(this).text().indexOf("Not Available") > -1)
          {
              var error3 = "Major not available for this school";
              return error3;
          }
        });

        $('option').each(function()
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
            var error1 = "Error with school name";
            res.send(JSON.stringify(error1));
        }
      }
      else
      {
          var error2 = "Error with school name";
          res.send(JSON.stringify(error2));
      }
    });
}

/**~*~*
  Gets the courses articulated between ia and oia.
*~**/
function getCourses(req, res)
{
  var ia = req.params.ia;
  var oia = req.params.oia;
  var dora = req.params.dora;
  dora = dora.replace('*','%2F');

  getAllCourses(req, res, ia, oia, dora);

}

function getAllCourses(req, res, ia, oia, dora)
{
    // Get the aay value.
    var url = 'http://www.assist.org/web-assist/articulationAgreement.do?inst1=none&inst2=none&ia='+ia+'&ay=15-16&oia='+oia+'&dir=1';
    request(url, function(error, response, html)
    {
      if(!error)
      {
        var aay = getAay(html);

        // Get the iframe.
        var url2 = 'http://www.assist.org/web-assist/report.do?agreement=aa&reportPath=REPORT_2&reportScript=Rep2.pl&event=19&dir=1&sia='+ia+'&ria='+oia+'&ia='+ia+'&oia='+oia+'&aay='+aay+'&ay=15-16&dora='+dora;
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

                res.send(JSON.stringify(getArticulations(text)));
              }
              else
              {
                  var error1 = "Error with major name";
                  res.send(JSON.stringify(error1));
              }
            });
          }
          else
          {
              var error2 = "Error with school name";
              res.send(JSON.stringify(error2));
          }
        });
      }
    });
}

/**~*~*
  Gets the aay value for institutions that have an older articulation agreement.
*~**/
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

/**~*~*
  Gets the iframe that contains the articulation agreement between the two institutions.
*~**/
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

/**~*~*
  Gets the articulated courses from the two institutions.
*~**/
function getArticulations(text)
{
  text = text.replace(/  +/g, ' ');
  var result = [];
  var from = false;
  var iaCourse = '';
  var oiaCourse = '';
  var courses = [];

  // Splits the text into course boxes.
  courses = text.match(/---[^-]+\|[^-]+---/g);

  // Split each box into from and to.
  courses.forEach(function(course)
  {
    // Remove dashes and extra notes.
    course = course.replace(/---[^-]*?\n(.*\|[^-]+)---/g, '$1').trim();

    for (var i = 0; i < course.length; ++i)
    {
      if (course[i] == '|' || course[i] == '\n')
      {
        oiaCourse += '\n';
        iaCourse += '\n';
        from = !from;
      }
      else if (!from)
      {
        oiaCourse += course[i];
      }
      else if (from)
      {
        iaCourse += course[i];
      }
    }

    if (/\(\d+\.?\d*\)/.test(oiaCourse) || /\(\d+\.?\d*\)/.test(iaCourse) || !isArticulated(oiaCourse) || !isArticulated(iaCourse))
    {
      result.push({ iaCourse: parseCourse(iaCourse), oiaCourse: parseCourse(oiaCourse) });
    }
    oiaCourse = '';
    iaCourse = '';
    from = !from;
  });
  return result;
}

/**~*~*
  Extracts the course information from raw course data.
*~**/
function parseCourse(text)
{
  // Splits each course using the units as a marker for the starting line.
  var courses = text.replace(/(^.*\(\d+\.?\d*\).|\n*)(^.*\(\d+\.?\d*\))/mg, '$1|$2')
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
    arr[i] = elem.replace(re, '$1 $2' + conjunctions.amp);
  });

  return conjunctionSplit(courses);
}

/**~*~*
  Splits the courses into individual courses connected by conjunctions.
*~**/
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
  var ampSplitted = line.split(conjunctions.amp);
  var course;
  ampSplitted.forEach(function(elem)
  {
    result.push(parseCourseData(elem));
  });
  return result;
}

function parseCourseData(line)
{
  // If course not articulated, result is empty.
  if (!isArticulated(line))
  {
    return;
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

    return { code: code, title: title, unit: unit };
  }
  return;
}

function isArticulated(line)
{
  var notArticulated  =
  [
    'no course articulated',
    'no articulation',
    'not articulated',
    'no comparable lab',
    'no comparable courses',
    'this course is never articulated'
  ];

  for (var i = 0; i < notArticulated.length; ++i)
  {
    if (line.toLowerCase().indexOf(notArticulated[i]) > -1)
    {
      return false;
    }
  }
  return true;
}

function getAll(req, res)
{
    var courseFromSchool = [];
    get_all_ias(function(err, ias){
        for (var ia in ias)
        {
            get_all_oias(ia['value'], function(err, oias){
                for (var oia in oias)
                {
                    get_all_dora(ia['value'], oia['value'], function(err, majors){
                        for (var major in majors)
                        {
                            getAllCourses(ia['value'], oia['value'], major['value'], function(err, courses){
                                courseFromSchool.push({
                                    ia: ia['name'],
                                    oia: oia['name'],
                                    major: major['major'],
                                    courses: courses
                                });
                            });
                        }
                    });
                }
            });
        }
        res.send(JSON.stringify(courseFromSchool));
    });
}



app.get('/ias', get_ias);
app.get('/:ia/oias', get_oias);
app.get('/:ia/:oia/dora', get_doras);
app.get('/:ia/:oia/:dora/courses', getCourses);
app.get('/getAll', getAll);

module.exports = app;
