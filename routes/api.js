var express = require('express');
var fs 			= require('fs');
var request = require('request');
var cheerio = require('cheerio');
var app     = express.Router();
var url 		= require('url');

var conjunctions =
{
	andEither : ' AND EITHER ',
	or 				: ' OR ',
	and 			: ' AND ',
	amp 			: ' & '
};

var notArticulated 	=
[
	'no course articulated',
	'not articulated',
	'no comparable lab'
];

// Displays the schools available to transfer to from De Anza College.
app.get('/schools', function(req, res)
{
 	var url = 'http://www.assist.org/web-assist/DAC.html';

	request(url, function(error, response, html)
	{
    if(!error)
    {
			var schools = getSchools(html);
  		res.send(JSON.stringify(schools));

    }
    else
    {
    	var err = { error: "Error with parsing" };
			res.send(JSON.stringify(err));
    }
	});
});

// Displays the majors available at the transfer school.
app.get('/:school/majors', function(req, res)
{
	var school = req.params.school;
	var url = 'http://www.assist.org/web-assist/articulationAgreement.do?inst1=none&inst2=none&ia=DAC&ay=15-16&oia='+school+'&dir=1';

	request(url, function(error, response, html)
	{
		if(!error)
		{
			var majors = getMajors(html);

			if(majors.length > 0)
			{
				res.send(JSON.stringify(majors));
			}
			else
			{
				var err2 = { error: "Error with school name" };
				res.send(JSON.stringify(err2));
			}
		}
		else
		{
			var err = { error: "Error with school name" };
			res.send(JSON.stringify(err));
		}
	});
});

// Displays the courses at De Anza College and its articulated course at transfer school.
app.get('/:school/:dora/classes', function(req, res)
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
							var err2 = { error: "Error with major name" };
							res.send(JSON.stringify(err2));
						}
					});
				}
				else
				{
					var err = { error: "Error with school name" };
					res.send(JSON.stringify(err));
				}
			});
		}
	});
});

function getSchools(html)
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

  return schools;
}

function getMajors(html)
{
	var $ = cheerio.load(html);
	var majors = [];

	$('#title').each(function(i, elem)
	{
		if($(this).text().indexOf("By Major") > -1 &&
			$(this).text().indexOf("Not Available") > -1)
		{
			var err = { error: "Major not available for this school" };
			res.end(JSON.stringify(err));
			return;
		}
	});

	$('option').each(function(i , elem)
	{
		if($(this).parent().attr('name') == 'dora' &&
			$(this).attr('value').length > 0 &&
			$(this).attr('value') != '-1')
		{
			var dora = $(this).text();
			var value = $(this).attr('value');
			majors.push( { major: dora + i, value: value });
		}
	});

	for(var z = 0; z < majors.length; z++)
	{
		majors[z].value = majors[z].value.replace('/','*');
	}

	return majors;
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
	// If course not articulated, result is empty.
	if (text.toLowerCase().indexOf(notArticulated[0]) > -1 ||
		text.toLowerCase().indexOf(notArticulated[1]) > -1 ||
		text.toLowerCase().indexOf(notArticulated[2]) > -1)
	{
		return [];
	}

	// Splits each course using the units as a marker for the starting line.
	// Conjunction is for course after current.
	var courses = text.replace(/(\(\d*\).|\n*)(^.*\(\d*\))/mg, '$1|$2')
		.replace(/\s\s+/g, ' ')
		.trim()
		.split('|')
		.filter(function(course)
		{
			return course !== '' && course !== '\n';
		});

	// Move & to end of line.
	courses.forEach(function(elem, i, arr)
	{
		arr[i] = elem.replace(/(.*)&(.*)/, '$1$2 &');
	})

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
	else if (line.indexOf(conjunctions.or) > -1)
	{
		result.push({ or: getOrSplitted(line) });
	}
	else if (line.indexOf(conjunctions.and) > -1)
	{
		// TODO.
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
	ampSplitted.forEach(function(elem)
	{
		result.push(parseCourseData(elem));
	});
	return result;
}

function parseCourseData(line)
{
	var unit = line.match(/\(\d+\.?\d*\)/);
	var code = code = line.replace(/(^.+?[0-9]+.*?)\s.+/, '$1');
	var title;
	if (unit)
	{
		unit = unit[0];

		title = line.replace(unit, '')
			.replace(code, '')
			.replace(/\s\s+/g, ' ')
			.trim();
		unit = unit.slice(1, -1);
		code = code.replace(/\s\s+/g, ' ');
	}

	return { code: code, title: title, unit: unit };
}

module.exports = app;
