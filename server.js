var express = require('express');
var fs = require('fs');
var request = require('request');
var cheerio = require('cheerio');
var app     = express();
var url = require('url');

app.get('/api', function(req, res){
	var body = "Assist scraper <br> <br> '/api' displays how to use api <br> '/api/getschools' displays the schools and SCHOOLVALUEs to transfer to <br> '/api/SCHOOLVALUE/getmajors' displays majors from the SCHOOLVALUE <br> '/api/SCHOOLVALUE/MAJORVALUE/getclasses' displays classes from MAJORVALUE of SCHOOLVALUE <br>";
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
	    	var err = {error:"Error with parsing"}
			res.send(JSON.stringify(err))
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


			$('#title').each(function(i, elem){
					if($(this).text().indexOf("By Major") > -1){
						if($(this).text().indexOf("Not Available") > -1){
							var err2 = {error:"Major not available for this school"}
							res.end(JSON.stringify(err2))
							return;
						}
					}
				
			})

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

			for(var z = 0; z < textArr.length; z++){
				textArr[z].value = textArr[z].value.replace('/','*')
			}
			if(textArr.length>0){
				res.send(JSON.stringify(textArr))
			}else{
				var err3 = {error:"Error with school name"}
				res.send(JSON.stringify(err3))
			}
			
		}else{
			var err = {error:"Error with school name"}
			res.send(JSON.stringify(err))
		}
	})
});
app.get('/api/:school/:dora/getclasses', function(req, res){
	var school = req.params.school;
	var dora = req.params.dora;
	dora = dora.replace('*','%2F')
	var url = 'http://www.assist.org/web-assist/report.do?agreement=aa&reportPath=REPORT_2&reportScript=Rep2.pl&event=19&dir=1&sia=DAC&ria='+school+'&ia=DAC&oia='+school+'&aay=15-16&ay=15-16&dora='+dora;
	console.log(url)
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
						var err2 = {error:"Error with major name"}
						res.send(JSON.stringify(err2))
				}
			});
		}else{
			var err = {error:"Error with school name"}
			res.send(JSON.stringify(err))
		}
	})
});

app.listen('8081')

console.log('running on port 8081');

exports = module.exports = app;