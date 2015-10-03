var express = require('express');
var fs = require('fs');
var request = require('request');
var cheerio = require('cheerio');
var app     = express();
var url = require('url');

app.get('/api', function(req, res){
	var body = "Assist scraper <br> <br> '/api' displays how to use api <br> '/api/getschools' displays the schools to transfer to <br> '/api/SCHOOLNAME/getmajors' displays majors from the SCHOOLNAME <br> '/api/SCHOOLNAME/MAJORNAME/getclasses' displays classes from MAJOR NAME of SCHOOLNAME <br>";
	res.send(body)
});
app.get('/api/getschools', function(req, res){
 	url = 'http://www.assist.org/web-assist/DAC.html';
	request(url, function(error, response, html){
	    if(!error){
	        var $ = cheerio.load(html);
			var textArr = [];

	        $('option').each(function(i, elem){
	        	if( $(this).parent().attr('id') == 'oia' && i != 188){
	        		var tempschool = $(this).text();
	        		tempschool = tempschool.replace('To:', '').trim();
	        		var tempvalue = $(this).attr('value');
	        		var url = require("url");
					var parts = url.parse(tempvalue, true);
					tempvalue = parts.query['oia']
	        	 	textArr.push( { school: tempschool, value: tempvalue});
	        	}
	        });


    		res.send(JSON.stringify(textArr));

	    }else{
	    	res.send('error with parse');
	    }
	})
})
app.get('/api/:school/getmajors', function(req, res){
	var school = req.params.school;
	var url = 'http://www.assist.org/web-assist/articulationAgreement.do?inst1=none&inst2=none&ia=DAC&ay=15-16&oia='+school+'&dir=1'
	request(url, function(error, response, html){
		if(!error){
			var $ = cheerio.load(html);
			var textArr = [];

			$('option').each(function(i , elem){
				if( $(this).parent().attr('name') == 'dora' &&
					$(this).attr('value').length > 0 &&
					$(this).attr('value') != '-1'
					){
					var dora = $(this).text();
					var val = $(this).attr('value');
					textArr.push( {major: dora + i, value:val})
				}
			})

			res.send(JSON.stringify(textArr))
		}else{
			res.send('error with school name')
		}
	})
});
app.get('/api/:school/:dora/getclasses', function(req, res){
	var school = req.params.school;
	var dora = req.params.dora;
	var url = 'http://www.assist.org/web-assist/report.do?agreement=aa&reportPath=REPORT_2&reportScript=Rep2.pl&event=19&dir=1&sia=DAC&ria='+school+'&ia=DAC&oia='+school+'&aay=15-16&ay=15-16&dora='+dora;

	request(url, function(error, response, html){
		if(!error){
			var $ = cheerio.load(html);
			var url2;
			$('iframe').each(function(i, elem){
				url2 = $(this).attr('src')

			})

			request(url2, function(error, response, html){
				if(!error){
					var $ = cheerio.load(html);
					var text = $('body').text();
					var n = text.match(/(\|\w*.)\w+/g);

					
					for(var v = 0; v < n.length; v++){
						n[v] = n[v].substring(1);
					}


					res.send(n)
				}else{
					res.send('error with major name')
				}
			});
		}else{
			res.send('error with class name')
		}
	})
});

app.listen('8081')

console.log('running on port 8081');

exports = module.exports = app;