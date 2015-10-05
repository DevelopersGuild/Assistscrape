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
							var college_courses = text.match(/(\|\w*.)\w+/g);
							for(var v = 0; v < college_courses.length; v++)
							{
								college_courses[v] = college_courses[v].substring(1);
							}
							res.send(
							{
								"data":
								{
									"required_courses": getRequiredCourses(text),
									"articulated_courses": college_courses
								}
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

//gets required text by plugging in html and regex
function getRequiredCourses(body) {
	var result = [];
	var index = 0;
	if (body)
	{
		var lines = body.split('\n');
		lines.forEach(function(entry)
		{
			if (entry.match(/(\|\w*.)\w+/g))
			{
				re = /([a-z])\w+/;
				matchedWords = re.exec(entry);
				var rawCode = entry.substring(0, matchedWords.index - 2).trim();
				rawCode = rawCode.replace(/[^a-zA-Z0-9\s]/g, '');
				if (rawCode)
				{
					result[index] = rawCode;
					index++;
				}
			}
		});
	}
	return result;
}

module.exports = app;
