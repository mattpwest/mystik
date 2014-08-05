# Mystik CMS [![npm version](http://img.shields.io/npm/v/mystik.svg)](https://npmjs.org/package/mystik) [![dependencies status](https://david-dm.org/mattpwest/mystik.png)](https://npmjs.org/package/mystik)

## Introduction
Mystik CMS is a simple, light-weight CMS written in Node.js. It is aimed at small websites that don't update their content that often (this is typical for many small businesses in my experience). So instead of focusing on making an extremely user-friendly editing interface, this CMS focuses on making life as easy as possible for the website developer:
* easy installation
* easy customisation
* easy backups
* easy upgrades
* good enough content editor

After all the developer will probably be the person spending the most time working on the website, so it's their time we should be saving...

## Usage
Before you can get started you will need to have [Node.js](http://nodejs.org/download/) installed.

### Installation
Once Node.js is installed getting Mystik is as simple as opening a console and doing:

    sudo npm install -g mystik

### Site Creation
You can create a new website from the console as follows:

    mystik -c /opt/mysite

### Theming
Once you have created a site you should run it in theming mode for customisation:

    cd /opt/mysite
    mystik

While in development mode:
* JavaScript is automatically linted and uglified every time you change it
* LESS files are automatically compiled to CSS every time you change them
* [BrowserSync](http://www.browsersync.io/) will automatically reload the page every time something changes and mirror changes across multiple browsers / tabs

The default administrative account is:
* admin@localhost
* admin

### Production
Once the site is ready you can test it without all the theming mode niceties by running it with the production mode flag:

    mystik -p

Of course you shouldn't be starting your production instance by hand like this, so once you are ready for production you should generate a Linux service script with:

    mystik -i

**Note:** *Currently this only works for Ubuntu based distributions that use Upstart for startup scripts. It also assumes the Node executable is called nodejs instead of node as is the case when installing from Apt.*

## Version History

* 0.1.0-alpha.3:
    * Added page types.
    * Added a second level of navigation.
    * Added a nice CodeMirror based editor.
    * Added syntax highlighting for a few languages using CodeMirror.
    * Added image / file uploads and insertion.
    * Added database upgrades that add new attributes to older database versions.
    * CLI
        * Changed theming mode to be the default.
        * Added -i switch to install an Upstart script.
* 0.1.0-alpha.2:
    * Added Bower.
    * Replaced LiveReload with BrowserSync.
    * Started using Q promises.
* 0.1.0-alpha.1:
    * Initial release.

## Roadmap
You can view the current TODO list on the [Trello board](https://trello.com/b/ozVTEkDw/mystik-cms).

### Design Goals
The design goals are informed by my experiences using a variety of PHP-based content management systems and wanting to write one that makes my life as easy as possible for building small sites for friends / family and small-business owners:
1. KISS
2. Ease of use for site developers
3. Easy content editing
4. Affordability
5. Scalability
6. Security

I provide a bit more detail on each of these goals below...

#### 1. KISS
I really don't want to wade through 1000s of lines of code or documentation the next time I need to do something custom for a little website I promised a friend or family member. I want something that gets out of the way and lets me get the job done ASAP so I can move on with my life.

#### 2. Ease of use for site developers
All administrative tasks like installation, backups and upgrades should be really easy to do.

Customisation (theming and more complex changes) should also be as easy as possible. 

#### 3. Easy content editing
This would typically be interpreted as having a complex WYSIWYG interface with lots of bells and whistles, but in my experience the typical site user (non-technical website administrator) will feign ignorance to having to do any content editing work themselves.

I think MarkDown with side-by-side preview as in the [Ghost CMS](https://ghost.org/features/) is more than sufficient for most site developers, while non-technical users that really want to get into content editing should also be able to grasp it if they make the effort.

#### 4. Affordability
You can get LAMP stack hosting in South Africa for around R60 a month (that's approximately $6 a month). You can get away even cheaper if you are   willing to struggle with one of the less competent hosting providers offerings or use an international provider.

For a Node.js based CMS to be able to compete you need comparably priced VPS hosting that can handle Node.js at the traffic volumes typical for such small sites. I've found the following options that look viable:
* [Digital Ocean](https://www.digitalocean.com/pricing/)'s $5 droplet
* [OpenShift](https://www.openshift.com/products/pricing)'s free 3 small gears 

#### 5. Scalability
The average small website you promise to do for your friends / family would probably measure traffic in the 10s or 100s of visits per month. A Node.js  should be more than capable of handling that...

Even so, developers won't use a CMS if it's not capable of scaling up when the need it to, so some goals that are of great import towards the end of the project are to:
* Test the NeDB -> MongoDB migration path.
* Make it easy to create a cluster of front-end servers sharing a single DB instance (those 3 free gears from OpenShift for example).

#### 6. Security
A bit of a me-too goal, but then you don't want some script kiddie to replace your mom's website content with porn or political slogans... software updates to Mystik should be easy to install as possible.

Should also see if we can automagically provide a self-signed SSL certificate to secure the editing and management pages of the site.
