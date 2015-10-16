Use DatabaseName;

#Again DatabaseName is a placeholder
#this is a table for users

Create Table users(
    username varchar(255) NOT NULL,
    password char(64) NOT NULL,
    #salt char(16) NOT NULL,
    email varchar(64) NOT NULL,
	PRIMARY KEY username ('username')
) Engine=InnoDB;