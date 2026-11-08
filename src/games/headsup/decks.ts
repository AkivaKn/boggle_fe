import type { Deck } from "./types";

const builtin = (
  id: string,
  name: string,
  emoji: string,
  group: string,
  words: string[],
): Deck => ({ id, name, emoji, group, words, builtin: true });

const list = (raw: string): string[] =>
  raw
    .trim()
    .split("\n")
    .map((word) => word.trim())
    .filter(Boolean);

export const BUILTIN_DECKS: Deck[] = [
  builtin(
    "animals",
    "Animals",
    "🐾",
    "Everyday",
    list(`
Dog
Cat
Elephant
Giraffe
Penguin
Kangaroo
Octopus
Dolphin
Tiger
Lion
Monkey
Rabbit
Horse
Cow
Pig
Sheep
Chicken
Duck
Owl
Eagle
Shark
Whale
Crocodile
Snake
Frog
Turtle
Spider
Bee
Butterfly
Ant
Squirrel
Fox
Wolf
Bear
Deer
Hippo
Rhino
Zebra
Panda
Koala
Camel
Sloth
Hedgehog
Peacock
Parrot
Goldfish
Bat
Seal
Otter
Beaver
Badger
Mole
Mouse
Rat
Hamster
Guinea pig
Ferret
Donkey
Goat
Llama
Alpaca
Bison
Buffalo
Moose
Elk
Reindeer
Gazelle
Cheetah
Leopard
Jaguar
Cougar
Lynx
Meerkat
Mongoose
Wombat
Platypus
Armadillo
Anteater
Porcupine
Skunk
Raccoon
Weasel
Stoat
Walrus
Manatee
Narwhal
Orca
Beluga whale
Squid
Jellyfish
Starfish
Crab
Lobster
Shrimp
Clam
Oyster
Seahorse
Stingray
Piranha
Salmon
Trout
Cod
Eel
Swordfish
Pelican
Flamingo
Swan
Goose
Turkey
Rooster
Ostrich
Emu
Kiwi
Toucan
Woodpecker
Hummingbird
Robin
Sparrow
Pigeon
Magpie
`),
  ),
  builtin(
    "food",
    "Food & Drink",
    "🍕",
    "Everyday",
    list(`
Pizza
Burger
Sushi
Spaghetti
Pancakes
Waffles
Toast
Cereal
Porridge
Sandwich
Salad
Soup
Curry
Tacos
Burrito
Fish and chips
Roast dinner
Steak
Sausage roll
Croissant
Doughnut
Ice cream
Chocolate
Biscuit
Cake
Apple pie
Strawberry
Banana
Pineapple
Watermelon
Grapes
Orange
Lemon
Avocado
Broccoli
Carrot
Potato
Onion
Garlic
Cheese
Butter
Yoghurt
Honey
Coffee
Tea
Milkshake
Lemonade
Hot chocolate
Lasagne
Mac and cheese
Shepherd's pie
Bangers and mash
Toad in the hole
Yorkshire pudding
Full English breakfast
Bacon sandwich
Beans on toast
Cheese toastie
Tuna sandwich
BLT
Caesar salad
Greek salad
Coleslaw
Hummus
Guacamole
Nachos
Quesadilla
Fajita
Paella
Risotto
Calzone
Garlic bread
Baguette
Pain au chocolat
Cinnamon roll
Scone
Victoria sponge
Battenberg cake
Trifle
Eton mess
Sticky toffee pudding
Apple crumble
Treacle tart
Bakewell tart
Shortbread
Jaffa cake
Flapjack
Brownie
Cheesecake
Pavlova
Tiramisu
Sundae
Candy floss
Popcorn
Crisps
Pretzel
Omelette
Scrambled eggs
Poached egg
Mushrooms
Smoothie
Orange juice
Apple juice
Cola
Ginger beer
Cider
Beer
Red wine
Champagne
Prosecco
Gin and tonic
Pimm's
Earl Grey tea
English breakfast tea
Matcha
Espresso
Cappuccino
Latte
Bubble tea
Mulled wine
`),
  ),
  builtin(
    "screen",
    "Movies & TV",
    "🎬",
    "Culture & People",
    list(`
Harry Potter
Lord of the Rings
Star Wars
Titanic
Jurassic Park
The Lion King
Toy Story
Shrek
The Matrix
Inception
Jaws
E.T.
Back to the Future
Ghostbusters
Home Alone
Mary Poppins
Grease
Frozen
Aladdin
Beauty and the Beast
Spider-Man
Batman
Avatar
Indiana Jones
Pirates of the Caribbean
James Bond
Paddington
Wallace & Gromit
Shaun the Sheep
The Snowman
The Gruffalo
Peppa Pig
Thunderbirds
Horrible Histories
Love Actually
Notting Hill
Four Weddings and a Funeral
The Full Monty
Billy Elliot
Bend It Like Beckham
Trainspotting
Lock, Stock and Two Smoking Barrels
The Crown
Doctor Who
Sherlock
The Traitors
Celebrity Traitors
The Traitors: Uncloaked
Strictly Come Dancing
The Great British Bake Off
I'm a Celebrity... Get Me Out of Here!
Love Island
Britain's Got Talent
The Masked Singer
The 1% Club
The Wheel
Gladiators
The Piano
The Apprentice
Dragons' Den
MasterChef
The Great British Sewing Bee
The Great Pottery Throw Down
The Night Manager
Line of Duty
Peaky Blinders
Slow Horses
Rivals
Adolescence
Baby Reindeer
Mr Bates vs The Post Office
The Thursday Murder Club
Gavin & Stacey
Only Fools and Horses
Fawlty Towers
Blackadder
Mr Bean
The Office (UK)
The Inbetweeners
Derry Girls
Fleabag
Killing Eve
Luther
Broadchurch
Happy Valley
Call the Midwife
Downton Abbey
Silent Witness
Death in Paradise
Vera
Midsomer Murders
Shetland
Taskmaster
Would I Lie to You?
Have I Got News for You
The Chase
Pointless
Countdown
The Repair Shop
Gogglebox
Antiques Roadshow
Countryfile
Match of the Day
Blue Peter
EastEnders
Coronation Street
Emmerdale
Hollyoaks
Casualty
The Split Up
The Blame
Dear England
The Lady
Tip Toe
The Party
Winter
This City Is Ours
Run Away
Small Prophets
Wild London
`),
  ),
  builtin(
    "music",
    "Music & Artists",
    "🎵",
    "Culture & People",
    list(`
The Beatles
Queen
ABBA
Elvis Presley
Michael Jackson
Madonna
Beyoncé
Taylor Swift
Ed Sheeran
Adele
Coldplay
The Rolling Stones
David Bowie
Prince
Elton John
Whitney Houston
Bob Marley
Johnny Cash
Dolly Parton
Lady Gaga
Bruno Mars
Rihanna
Drake
Eminem
Jay-Z
Kanye West
Billie Eilish
Nirvana
Radiohead
Pink Floyd
U2
Spice Girls
One Direction
Take That
Oasis
Blur
The Who
Led Zeppelin
Aretha Franklin
Stevie Wonder
Harry Styles
Dua Lipa
Charli XCX
RAYE
Olivia Dean
Sam Fender
Dave
Central Cee
Stormzy
Little Simz
Skepta
J Hus
Fred again..
PinkPantheress
Sienna Spiro
Jamie Miller
Lola Young
Myles Smith
Lewis Capaldi
Sam Smith
Hozier
Florence + the Machine
Mumford & Sons
Bastille
The 1975
Arctic Monkeys
Kasabian
The Libertines
Franz Ferdinand
Kaiser Chiefs
Snow Patrol
Keane
James Blunt
Lily Allen
Amy Winehouse
George Michael
Wham!
Kate Bush
Pet Shop Boys
Duran Duran
Eurythmics
The Police
Sting
The Clash
Sex Pistols
The Smiths
Joy Division
New Order
The Stone Roses
Happy Mondays
Primal Scream
Underworld
The Chemical Brothers
Fatboy Slim
Massive Attack
Portishead
Gorillaz
Depeche Mode
The Cure
Pulp
Suede
Olivia Rodrigo
Ariana Grande
Djo
Tate McRae
Manic Street Preachers
The Wombats
Two Door Cinema Club
Foals
Wolf Alice
IDLES
Fontaines D.C.
Wet Leg
Rag'n'Bone Man
Tom Grennan
George Ezra
Kylie Minogue
Calvin Harris
Sabrina Carpenter
Chappell Roan
`),
  ),
  builtin(
    "faces",
    "Famous Faces",
    "🌟",
    "Culture & People",
    list(`
Albert Einstein
William Shakespeare
Queen Elizabeth II
Winston Churchill
Nelson Mandela
Mahatma Gandhi
Martin Luther King Jr.
Cleopatra
Napoleon
Julius Caesar
Leonardo da Vinci
Vincent van Gogh
Pablo Picasso
Frida Kahlo
Mozart
Beethoven
Charles Darwin
Isaac Newton
Marie Curie
Stephen Hawking
Neil Armstrong
Amelia Earhart
Lionel Messi
Cristiano Ronaldo
Serena Williams
Usain Bolt
Michael Jordan
Muhammad Ali
David Beckham
Tom Hanks
Meryl Streep
Oprah Winfrey
Barack Obama
Elon Musk
Bill Gates
Richard Osman
Meera Syal
Warwick Davis
J.K. Rowling
Queen Victoria
King Charles III
Queen Camilla
Prince William
Princess Kate
Prince Harry
Meghan Markle
Princess Anne
Princess Diana
Keir Starmer
Andy Burnham
Kemi Badenoch
Nigel Farage
Ed Davey
Boris Johnson
Rishi Sunak
Theresa May
David Cameron
Tony Blair
Margaret Thatcher
Henry VIII
Elizabeth I
Guy Fawkes
Florence Nightingale
Emmeline Pankhurst
Alan Turing
Ada Lovelace
Tim Berners-Lee
Alexander Fleming
Rosalind Franklin
Mary Seacole
Isambard Kingdom Brunel
Jane Austen
Charles Dickens
Roald Dahl
Agatha Christie
J.R.R. Tolkien
George Orwell
Virginia Woolf
Banksy
David Attenborough
Idris Elba
Cynthia Erivo
Judi Dench
Helen Mirren
Ian McKellen
Patrick Stewart
Tom Holland
Benedict Cumberbatch
Daniel Craig
Kate Winslet
Olivia Colman
Florence Pugh
Ncuti Gatwa
Billie Piper
David Tennant
Rowan Atkinson
Ricky Gervais
Graham Norton
Ant & Dec
Claudia Winkleman
Sarina Wiegman
Davina McCall
Alison Hammond
Maya Jama
Simon Cowell
Gordon Ramsay
Paul Hollywood
Mary Berry
Prue Leith
Jeremy Clarkson
Richard Hammond
James May
KSI
Leah Williamson
Jude Bellingham
Harry Kane
Bukayo Saka
Luke Littler
Lando Norris
Emma Raducanu
`),
  ),
  builtin(
    "actions",
    "Actions",
    "🏃",
    "Everyday",
    list(`
Running
Jumping
Swimming
Dancing
Singing
Laughing
Crying
Sneezing
Yawning
Sleeping
Snoring
Eating
Drinking
Cooking
Baking
Washing up
Hoovering
Gardening
Painting
Drawing
Writing
Reading
Driving
Cycling
Ice skating
Skiing
Surfing
Climbing
Fishing
Camping
Shopping
Cleaning
Ironing
Knitting
Sewing
Juggling
Boxing
Wrestling
Bowling
Golfing
Playing tennis
Playing football
Skipping
Stretching
Brushing teeth
Combing hair
Tying shoelaces
Blowing a kiss
Sailing
Rowing
Kayaking
Paddleboarding
Snorkelling
Scuba diving
Horse riding
Skateboarding
Rollerblading
Snowboarding
Sledging
Rock climbing
Bungee jumping
Skydiving
Paragliding
Zip-lining
Abseiling
Orienteering
Hiking
Running a marathon
Sprinting
Long jump
High jump
Pole vault
Shot put
Javelin
Discus
Hurdling
Doing a cartwheel
Doing a handstand
Doing a backflip
Breakdancing
Ballet dancing
Tap dancing
Ballroom dancing
Line dancing
Conducting an orchestra
Playing the drums
Playing the guitar
Playing the piano
Playing the trumpet
Playing the violin
Singing in the shower
Karaoke
Beatboxing
Whistling
Humming
Clapping
Cheering
Booing
Whispering
Shouting
Arguing
Apologising
Telling a joke
Telling a lie
Giving a speech
Asking a question
Taking a selfie
Filming a video
Texting
Scrolling
Swiping
Taking a nap
Waking up
Getting dressed
Doing makeup
Shaving
Having a bath
Taking a shower
Washing hair
Brushing hair
`),
  ),
  builtin(
    "house",
    "Around the House",
    "🏠",
    "Everyday",
    list(`
Sofa
Table
Chair
Bed
Wardrobe
Mirror
Curtains
Carpet
Lamp
Ceiling light
Television
Remote control
Kettle
Toaster
Microwave
Oven
Fridge
Freezer
Dishwasher
Washing machine
Tumble dryer
Iron
Vacuum cleaner
Broom
Mop
Bucket
Dustpan
Bin
Sink
Tap
Shower
Bath
Toilet
Toothbrush
Towel
Soap
Shampoo
Hairdryer
Pillow
Duvet
Blanket
Clock
Picture frame
Bookshelf
Door
Window
Stairs
Front door
Doorbell
Doormat
Key
Keyhole
Lock
Handle
Light switch
Plug socket
Extension lead
Light bulb
Candles
Air freshener
Radiator
Boiler
Thermostat
Smoke alarm
Fire extinguisher
First aid kit
Toolbox
Hammer
Screwdriver
Drill
Saw
Spanner
Nails
Screws
Tape measure
Step ladder
Paintbrush
Paint roller
Wallpaper
Tile
Grout
Shelf
Drawer
Cupboard
Kitchen counter
Kitchen island
Chopping board
Knife
Fork
Spoon
Plate
Bowl
Mug
Glass
Teapot
Frying pan
Saucepan
Baking tray
Colander
Grater
Peeler
Whisk
Spatula
Rolling pin
Tin opener
Bottle opener
Corkscrew
Food processor
Blender
Coffee machine
Rice cooker
Slow cooker
Air fryer
Bread bin
Fruit bowl
Dish rack
Tea towel
Oven glove
Apron
Bin bag
`),
  ),
  builtin(
    "tech",
    "Tech & Internet",
    "💻",
    "Everyday",
    list(`
Computer
Laptop
Smartphone
Tablet
Keyboard
Mouse
Monitor
Printer
Webcam
Headphones
Charger
USB stick
Hard drive
Router
Wi-Fi
Bluetooth
Email
Password
Selfie
Emoji
Hashtag
Meme
GIF
Podcast
Streaming
Download
Upload
Cloud
Spreadsheet
Browser
Search engine
Social media
Video call
Text message
Screenshot
Update
Reboot
Bug
Virus
Firewall
Artificial intelligence
Chatbot
Algorithm
App
Notification
Playlist
Smartwatch
Fitness tracker
Drone
Robot vacuum
Smart speaker
Virtual assistant
QR code
Barcode
Contactless payment
Online banking
Cryptocurrency
NFT
Metaverse
Virtual reality
Augmented reality
Gaming console
Controller
Joystick
Graphics card
Processor
Motherboard
RAM
SSD
Data centre
Server
Domain name
Website
Homepage
Link
Cookie
Cache
Incognito mode
Ad blocker
Pop-up
Spam
Phishing
Two-factor authentication
Face recognition
Fingerprint scanner
Digital footprint
Data breach
Encryption
VPN
Proxy
Bandwidth
Latency
5G
Fibre broadband
Hotspot
AirDrop
Live stream
Webinar
Zoom call
Spreadsheet formula
Presentation
PDF
Word document
Attachment
Inbox
Outbox
Spam folder
Unsubscribe
Newsletter
Blog
Vlog
Influencer
Follower
Like button
Comment section
Direct message
Group chat
Voice note
Face filter
Deepfake
`),
  ),
  builtin(
    "sports",
    "Sports & Games",
    "🏆",
    "Culture & People",
    list(`
Football
Rugby union
Cricket
Tennis
Golf
Boxing
Darts
Snooker
Formula 1
Cycling
Athletics
Swimming
Gymnastics
Netball
Hockey
Badminton
Squash
Table tennis
Basketball
Volleyball
Baseball
American football
Ice hockey
Skiing
Snowboarding
Figure skating
Speed skating
Curling
Bobsleigh
Luge
Skeleton
Rowing
Sailing
Canoeing
Kayaking
Surfing
Skateboarding
Climbing
Horse racing
Show jumping
Fencing
Judo
Taekwondo
Karate
Weightlifting
Powerlifting
Wrestling
Marathon
Triathlon
Decathlon
Heptathlon
Commonwealth Games
Glasgow 2026
Finnie the unicorn
World Cup 2026
Wembley Stadium
Six Nations
Wimbledon
The Open
British Grand Prix
Silverstone
Grand National
Aintree
London Marathon
Women's T20 World Cup
The Ashes
The Hundred
County Cricket
Premier League
FA Cup
Carabao Cup
Champions League
Europa League
WSL
England football team
Scotland football team
Wales football team
Northern Ireland football team
Lionesses
Rugby World Cup
Gallagher Premiership
Super League
Magic Weekend
Challenge Cup
Tour de France
Tour of Britain
Olympics
Winter Olympics
Milano Cortina 2026
Paralympics
European Athletics Championships
Birmingham 2026
Queen's Club
Royal Ascot
Cheltenham Festival
The Boat Race
Ryder Cup
Solheim Cup
World Snooker Championship
Crucible Theatre
PDC World Darts Championship
Alexandra Palace
Luke Littler
Monopoly
Scrabble
Cluedo
Chess
Draughts
Uno
Jenga
Twister
Pictionary
Charades
Table football
Connect Four
Snakes and Ladders
Ludo
Dominoes
Wordle
Sudoku
`),
  ),
  builtin(
    "travel",
    "Travel & Places",
    "🌍",
    "World & Ideas",
    list(`
London
Edinburgh
Cardiff
Belfast
Dublin
Manchester
Liverpool
Birmingham
Glasgow
Leeds
Bristol
Brighton
Oxford
Cambridge
Bath
York
Durham
Newcastle
Sheffield
Nottingham
Leicester
Coventry
Stratford-upon-Avon
Stonehenge
Lake District
Snowdonia
Scottish Highlands
Loch Ness
Isle of Skye
Giant's Causeway
Cliffs of Moher
Cotswolds
Cornwall
Devon
Blackpool
Scarborough
Whitby
Bournemouth
Isle of Wight
Channel Islands
Paris
Rome
Barcelona
Madrid
Lisbon
Amsterdam
Berlin
Prague
Vienna
Venice
Florence
Athens
Istanbul
Cairo
Marrakech
Cape Town
Nairobi
Dubai
Mumbai
Delhi
Bangkok
Singapore
Tokyo
Kyoto
Seoul
Beijing
Shanghai
Hong Kong
Sydney
Melbourne
Auckland
New York
Los Angeles
San Francisco
Chicago
Toronto
Vancouver
Mexico City
Rio de Janeiro
Buenos Aires
Machu Picchu
Great Wall of China
Taj Mahal
Pyramids of Giza
Eiffel Tower
Colosseum
Sagrada Familia
Statue of Liberty
Niagara Falls
Grand Canyon
Amazon Rainforest
Sahara Desert
Mount Everest
Antarctica
The Shard
Buckingham Palace
Tower of London
Big Ben
London Eye
Trafalgar Square
Piccadilly Circus
Camden Market
Hyde Park
Heathrow Airport
King's Cross Station
Blackpool Tower
Angel of the North
Hadrian's Wall
White Cliffs of Dover
Land's End
John O'Groats
Ben Nevis
Loch Lomond
Edinburgh Castle
Cardiff Castle
Titanic Belfast
Glasgow Cathedral
The Gherkin
St Paul's Cathedral
Westminster Abbey
`),
  ),
  builtin(
    "jobs",
    "Jobs & Professions",
    "👩‍🚀",
    "World & Ideas",
    list(`
Doctor
Nurse
Teacher
Lawyer
Barrister
Judge
Police officer
Firefighter
Paramedic
Dentist
Vet
Farmer
Chef
Waiter
Barista
Baker
Butcher
Florist
Hairdresser
Barber
Plumber
Electrician
Carpenter
Builder
Architect
Engineer
Mechanic
Pilot
Flight attendant
Train driver
Bus driver
Taxi driver
Postman
Courier
Delivery driver
Lorry driver
Sailor
Fisherman
Soldier
RAF pilot
Lifeguard
Park ranger
Zookeeper
Scientist
Chemist
Physicist
Biologist
Astronomer
Astronaut
Meteorologist
Journalist
Newsreader
Photographer
Filmmaker
Actor
Singer
Dancer
Musician
DJ
Author
Poet
Editor
Publisher
Librarian
Curator
Accountant
Banker
Economist
Financial adviser
Estate agent
Surveyor
Civil servant
Politician
Diplomat
Translator
Interpreter
Tour guide
Travel agent
Hotel manager
Receptionist
Cleaner
Gardener
Landscaper
Window cleaner
Refuse collector
Road worker
Traffic warden
Security guard
Bouncer
Personal trainer
Yoga teacher
Football coach
Referee
Umpire
Sports commentator
Game show host
Magician
Clown
Priest
Vicar
Rabbi
Imam
Monk
Nun
Therapist
Psychologist
Psychiatrist
Social worker
Care worker
Childminder
Nanny
Dog walker
Groom
Jockey
Blacksmith
Potter
Glassblower
Tailor
Fashion designer
Makeup artist
`),
  ),
  builtin(
    "nature",
    "Nature & Outdoors",
    "🌿",
    "World & Ideas",
    list(`
Mountain
Valley
Hill
Cliff
Coast
Beach
Cave
Waterfall
River
Stream
Lake
Pond
Ocean
Sea
Island
Peninsula
Glacier
Volcano
Forest
Woodland
Rainforest
Jungle
Meadow
Moorland
Heath
Marsh
Swamp
Desert
Dune
Canyon
Gorge
Plateau
Prairie
Savannah
Tundra
Arctic
Antarctic
Reef
Lagoon
Estuary
Delta
Geyser
Hot spring
Rock pool
Tide
Wave
Current
Whirlpool
Sunrise
Sunset
Rainbow
Lightning
Thunder
Storm
Cloud
Fog
Mist
Dew
Frost
Snow
Hail
Sleet
Wind
Breeze
Gale
Tornado
Hurricane
Blizzard
Heatwave
Drought
Flood
Avalanche
Earthquake
Landslide
Wildfire
Oak tree
Willow tree
Pine tree
Birch tree
Palm tree
Fern
Moss
Ivy
Bluebell
Daffodil
Snowdrop
Poppy
Rose
Thistle
Shamrock
Lavender
Sunflower
Mushroom
Acorn
Pine cone
Badger
Otter
Red squirrel
Hedgehog
Robin
Kingfisher
Puffin
Seal
Dolphin
Whale
Butterfly
Dragonfly
Ladybird
Bee
Ant
Spider
Frog
Newt
Snake
Fox
Deer
Owl
Bat
Eagle
Falcon
`),
  ),
  builtin(
    "science",
    "Science & Space",
    "🚀",
    "World & Ideas",
    list(`
Solar system
Sun
Mercury
Venus
Earth
Mars
Jupiter
Saturn
Uranus
Neptune
Pluto
Moon
Asteroid
Comet
Meteor
Meteorite
Galaxy
Milky Way
Black hole
Supernova
Nebula
Constellation
Star
Planet
Orbit
Gravity
Telescope
Rocket
Satellite
Space station
Astronaut
Spacesuit
Spacewalk
Launchpad
Countdown
Mission control
NASA
ESA
SpaceX
James Webb telescope
Hubble telescope
International Space Station
Apollo 11
Moon landing
Neil Armstrong
Buzz Aldrin
Yuri Gagarin
Tim Peake
Helen Sharman
Brian Cox
Stephen Hawking
Isaac Newton
Albert Einstein
Galileo
Copernicus
Kepler
Atom
Molecule
Electron
Proton
Neutron
Nucleus
Quark
Photon
DNA
Gene
Chromosome
Cell
Virus
Bacteria
Fungus
Evolution
Natural selection
Photosynthesis
Respiration
Digestive system
Heart
Brain
Lungs
Skeleton
Blood
Neuron
Vaccination
Antibiotic
Penicillin
Microscope
Laboratory
Experiment
Hypothesis
Periodic table
Oxygen
Hydrogen
Carbon
Nitrogen
Helium
Gold
Silver
Iron
Copper
Sodium
Acid
Alkali
Chemical reaction
States of matter
Solid
Liquid
Gas
Plasma
Magnetism
Electricity
Circuit
Battery
Laser
X-ray
Radio wave
Microwave
Sound wave
Light year
Speed of light
Quantum physics
`),
  ),
  builtin(
    "history",
    "History & Myths",
    "🏛️",
    "World & Ideas",
    list(`
Stonehenge
The Romans
Roman Britain
Hadrian's Wall
Julius Caesar
Boudicca
The Vikings
The Normans
Battle of Hastings
William the Conqueror
Magna Carta
King John
The Black Death
The Wars of the Roses
Henry VIII
Anne Boleyn
Elizabeth I
Spanish Armada
Guy Fawkes
Gunpowder Plot
Charles I
English Civil War
Oliver Cromwell
Great Fire of London
Samuel Pepys
The Tudors
The Stuarts
The Georgians
The Victorians
Queen Victoria
Industrial Revolution
Steam engine
Isambard Kingdom Brunel
Florence Nightingale
Mary Seacole
Emmeline Pankhurst
Suffragettes
World War I
World War II
Winston Churchill
Battle of Britain
The Blitz
D-Day
Anne Frank
The Holocaust
Cold War
Berlin Wall
Nelson Mandela
Mahatma Gandhi
Martin Luther King Jr.
The Moon landing
The fall of the Berlin Wall
The Great Exhibition
The British Empire
The East India Company
The Boston Tea Party
The French Revolution
Napoleon
Marie Antoinette
Cleopatra
Ancient Egypt
Pyramids
The Pharaohs
Tutankhamun
Ancient Greece
Athens
Sparta
Greek gods
Zeus
Hera
Poseidon
Athena
Apollo
Aphrodite
Ares
Hercules
Achilles
Trojan Horse
The Odyssey
Odysseus
Ancient Rome
Colosseum
Gladiators
Mount Vesuvius
Pompeii
The Aztecs
The Maya
The Inca
Machu Picchu
The Mongols
Genghis Khan
The Silk Road
The Ottoman Empire
The Crusades
The Knights Templar
Robin Hood
King Arthur
Merlin
Excalibur
The Round Table
Guinevere
Lancelot
Lady of the Lake
The Loch Ness Monster
Nessie
Bigfoot
The Yeti
The Bermuda Triangle
Atlantis
El Dorado
The Fountain of Youth
The Holy Grail
Dracula
Frankenstein
The Mummy
Werewolf
Vampire
Zombie
Ghost
UFO
`),
  ),
];
