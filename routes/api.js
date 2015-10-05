var express = require('express');
var fs 			= require('fs');
var request = require('request');
var cheerio = require('cheerio');
var app     = express.Router();
var url 		= require('url');

// Displays the schools available to transfer to from De Anza College.
app.get('/schools', function(req, res)
{
 	url = 'http://www.assist.org/web-assist/DAC.html';

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
					var parts = url.parse(value, true).query.oia;
					value = parts.query.oia;
      	 	schools.push( { school: school, value: value} );
      	}
      });
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
			var $ = cheerio.load(html);
			var majors = [];

			$('#title').each(function(i, elem)
			{
				if($(this).text().indexOf("By Major") > -1 &&
					$(this).text().indexOf("Not Available") > -1)
				{
					var err2 = { error: "Major not available for this school" };
					res.end(JSON.stringify(err2));
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
					majors.push( { major: dora + i, value: val });
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
				var err3 = { error: "Error with school name" };
				res.send(JSON.stringify(err3));
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
	var aay = '15-16';

	// Get the aay value.
	var url = 'http://www.assist.org/web-assist/articulationAgreement.do?inst1=none&inst2=none&ia=DAC&ay=15-16&oia='+school+'&dir=1';
	request(url, function(error, response, html)
	{
		if(!error)
		{
			var $ = cheerio.load(html);
			$('input').each(function(i, elem)
			{
				if($(this).parent().attr('name') == 'major' &&
					$(this).attr('name') == 'aay')
				{
					aay = $(this).attr('value');
				}
			});

			// Get the iframe.
			var url2 = 'http://www.assist.org/web-assist/report.do?agreement=aa&reportPath=REPORT_2&reportScript=Rep2.pl&event=19&dir=1&sia=DAC&ria='+school+'&ia=DAC&oia='+school+'&aay='+aay+'&ay=15-16&dora='+dora;
			console.log('url2 = ' + url2);
			request(url2, function(error, response, html)
			{
				if(!error)
				{
					var $ = cheerio.load(html);
					var url3;
					$('iframe').each(function(i, elem)
					{
						url3 = $(this).attr('src');
					});

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

function getCourses(text)
{
	text = text.replace(/  +/g, ' ');
	var result = [];
	var courses = [];
	courses = text.match(/---([^-]+)\|([^-]+)---/g);

	var from = true;
	var fromCourse = '';
	var toCourse = '';
	courses.forEach(function(course)
	{
		course = course.slice(3, -3);
		for (var i = 0; i < course.length; ++i)
		{
			if (course[i] == '|' || course[i] == '\n')
			{
				toCourse += ' ';
				fromCourse += ' ';
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
	var notArticulated 	= 'no course articulated';
	var notArticulated2 = 'not articulated';
	var notArticulated3 = 'no comparable lab';

	if (text.toLowerCase().indexOf(notArticulated) > -1 ||
		text.toLowerCase().indexOf(notArticulated2) > -1 ||
		text.toLowerCase().indexOf(notArticulated3) > -1)
	{
		return [];
	}
	var result = [];

	var or = text.split('OR');
	or.forEach(function(orSplit)
	{
		if (text.indexOf('OR') > -1)
		{
			result.push({ or: getOrSplitted(orSplit) });
		}
		else
		{
			result.push(getOrSplitted(orSplit));
		}
	});
	return result;
}

function getOrSplitted(orSplit)
{
	var amp = orSplit.replace(/(.*&.*\([0-9]\).*)( [A-Z][A-Z]+.*\([0-9]\))/, '$1|$2')
		.split('|');
	var result = [];

	amp.forEach(function(ampSplit)
	{
		if (orSplit.indexOf('&') > -1)
		{
			result.push({ and: getAmpSplitted(ampSplit) });
		}
		else
		{
			result.push(getAmpSplitted(ampSplit));
		}
	});
	return result;
}

function getAmpSplitted(ampSplit)
{
	var ampRemovedSplit;
	var unit;
	var code;
	var title;

	ampRemovedSplit = ampSplit.replace('&', '');
	unit = ampRemovedSplit.match(/(\([0-9]+\))/)[0].slice(1, -1);
	code = ampRemovedSplit.match(/\w[a-zA-Z ]+ \d+\w*/)[0];
	title = ampRemovedSplit.replace(unit, '')
		.replace(code, '')
		.replace(/[^\w\s]+/, ' ')
		.replace(/\s\s+/g, ' ')
		.trim();

	return { code: code, title: title, unit: unit };
}

module.exports = app;
