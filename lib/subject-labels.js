"use strict";
// Localised labels for gallery generation subjects, keyed lang → English subject.
// Shown on topic-page cards, image pages and the app's Explore grid instead of the
// English prompt text. gallery.subjectLabel() falls back to English when missing.
// German lives here for new topics and is merged into gallery.DE_SUBJECT_LABELS.

const CAR = [
  "cute cartoon car with big wheels and a happy face",
  "classic vintage car with round headlights",
  "sporty race car with stripes and a big spoiler",
  "convertible car driving along the seaside",
  "monster truck with giant tires",
  "camper van parked at a campsite by a lake",
  "family car with suitcases on the roof rack",
  "off-road jeep driving through the jungle",
  "tow truck pulling a little broken-down car",
];

// One row per language, in CAR order.
const CAR_LABELS = {
  de: ["Fröhliches Auto mit großen Rädern", "Oldtimer mit runden Scheinwerfern", "Rennwagen mit Streifen und Heckspoiler", "Cabrio an der Küste", "Monstertruck mit Riesenreifen", "Wohnmobil am See", "Familienauto mit Koffern auf dem Dach", "Geländewagen im Dschungel", "Abschleppwagen mit kleinem Auto"],
  fr: ["Voiture rigolote aux grosses roues", "Voiture ancienne aux phares ronds", "Voiture de course à bandes avec aileron", "Cabriolet au bord de la mer", "Monster truck aux pneus géants", "Camping-car au bord d’un lac", "Voiture familiale avec valises sur le toit", "Jeep tout-terrain dans la jungle", "Dépanneuse qui remorque une petite voiture"],
  es: ["Coche alegre con ruedas grandes", "Coche clásico con faros redondos", "Coche de carreras con rayas y alerón", "Descapotable junto al mar", "Monster truck con ruedas gigantes", "Autocaravana junto a un lago", "Coche familiar con maletas en el techo", "Todoterreno en la selva", "Grúa remolcando un cochecito"],
  pt: ["Carrinho alegre com rodas grandes", "Carro antigo com faróis redondos", "Carro de corrida com listras e aerofólio", "Conversível à beira-mar", "Monster truck com pneus gigantes", "Motorhome à beira de um lago", "Carro da família com malas no teto", "Jipe na selva", "Guincho rebocando um carrinho"],
  ru: ["Весёлая машинка с большими колёсами", "Ретро-автомобиль с круглыми фарами", "Гоночная машина с полосками и спойлером", "Кабриолет у моря", "Монстр-трак с огромными колёсами", "Дом на колёсах у озера", "Семейная машина с чемоданами на крыше", "Внедорожник в джунглях", "Эвакуатор везёт маленькую машинку"],
  it: ["Macchinina allegra con ruote grandi", "Auto d’epoca con fari rotondi", "Auto da corsa con strisce e alettone", "Cabriolet in riva al mare", "Monster truck con ruote giganti", "Camper in riva a un lago", "Auto di famiglia con valigie sul tetto", "Fuoristrada nella giungla", "Carro attrezzi che traina una macchinina"],
  nl: ["Vrolijk autootje met grote wielen", "Oldtimer met ronde koplampen", "Raceauto met strepen en spoiler", "Cabrio langs de kust", "Monstertruck met reuzenbanden", "Camper bij een meer", "Gezinsauto met koffers op het dak", "Jeep in de jungle", "Takelwagen met een klein autootje"],
  pl: ["Wesoły samochodzik z dużymi kołami", "Zabytkowy samochód z okrągłymi reflektorami", "Wyścigówka w paski ze spojlerem", "Kabriolet nad morzem", "Monster truck z ogromnymi oponami", "Kamper nad jeziorem", "Rodzinne auto z walizkami na dachu", "Terenówka w dżungli", "Laweta holująca mały samochodzik"],
  tr: ["Kocaman tekerlekli neşeli araba", "Yuvarlak farlı klasik araba", "Çizgili, rüzgârlıklı yarış arabası", "Deniz kenarında üstü açık araba", "Dev tekerlekli canavar kamyon", "Göl kenarında karavan", "Tavanında bavullar olan aile arabası", "Ormanda arazi aracı", "Küçük arabayı çeken çekici"],
  zh: ["大轮子的快乐小汽车", "圆车灯的老爷车", "带条纹和尾翼的赛车", "海边的敞篷车", "大轮胎怪兽卡车", "湖边的房车", "车顶放着行李箱的家庭轿车", "丛林里的越野车", "拖着小汽车的拖车"],
  hi: ["बड़े पहियों वाली खुशमिज़ाज कार", "गोल हेडलाइट वाली पुरानी कार", "धारियों और स्पॉइलर वाली रेस कार", "समुद्र किनारे खुली छत वाली कार", "विशाल टायरों वाला मॉन्स्टर ट्रक", "झील के किनारे कैंपर वैन", "छत पर सूटकेस वाली परिवार की कार", "जंगल में ऑफ-रोड जीप", "छोटी कार को खींचता टो ट्रक"],
};

// The 8 original evergreen topics (gallery.TOPIC_META subjects), 7 per topic in
// topic order: dragon, unicorn, butterfly, dinosaur, cat, princess, mermaid,
// rocket. Until 2026-11 their pictures showed the English prompt on every
// language's page (e.g. "Fluffy cat sitting Boyama Sayfası").
const EVERGREEN = [
  "dragon flying over mountains", "cute baby dragon", "small friendly dragon", "dragon guarding treasure", "dragon with spread wings", "dragon curled up sleeping", "fire-breathing dragon",
  "unicorn with rainbow mane", "magical unicorn in meadow", "running unicorn", "unicorn with flowers", "unicorn in enchanted forest", "unicorn jumping over rainbow", "baby unicorn playing",
  "butterfly with geometric wings", "butterfly on a flower", "monarch butterfly", "butterfly emerging from cocoon", "two butterflies flying", "butterfly in a garden", "colorful butterfly with big wings",
  "friendly triceratops", "cute dinosaur hatching from egg", "velociraptor running", "pterodactyl flying", "stegosaurus with spiky back", "long-neck brachiosaurus", "baby t-rex",
  "kitten playing with yarn", "fluffy cat sitting", "cat chasing a butterfly", "cat on a windowsill", "playful kitten", "cat jumping", "cat curled up sleeping",
  "princess with a crown", "princess in a castle tower", "princess with a magic wand", "princess dancing at a ball", "princess in a magical forest", "princess and a dragon", "princess riding a horse",
  "mermaid sitting on a rock", "mermaid with a dolphin", "mermaid holding a pearl", "mermaid with long flowing hair", "mermaid with sea creatures", "mermaid swimming underwater", "baby mermaid exploring coral reef",
  "rocket flying past planets", "rocket launching into space", "rocket and shooting stars", "small rocket with booster flames", "rocket with astronaut window", "cute rocket ship", "rocket landing on the moon",
];

// One row per language, in EVERGREEN order.
const EVERGREEN_LABELS = {
  de: [
    "Drache fliegt über die Berge", "Süßes Drachenbaby", "Kleiner freundlicher Drache", "Drache bewacht einen Schatz", "Drache mit ausgebreiteten Flügeln", "Zusammengerollter schlafender Drache", "Feuerspeiender Drache",
    "Einhorn mit Regenbogenmähne", "Zauberhaftes Einhorn auf der Wiese", "Galoppierendes Einhorn", "Einhorn mit Blumen", "Einhorn im Zauberwald", "Einhorn springt über den Regenbogen", "Spielendes Einhornbaby",
    "Schmetterling mit geometrischen Flügeln", "Schmetterling auf einer Blume", "Monarchfalter", "Schmetterling schlüpft aus dem Kokon", "Zwei fliegende Schmetterlinge", "Schmetterling im Garten", "Bunter Schmetterling mit großen Flügeln",
    "Freundlicher Triceratops", "Dinobaby schlüpft aus dem Ei", "Rennender Velociraptor", "Fliegender Flugsaurier", "Stegosaurus mit Stachelrücken", "Langhals-Brachiosaurus", "T-Rex-Baby",
    "Kätzchen spielt mit Wolle", "Flauschige Katze sitzt", "Katze jagt einen Schmetterling", "Katze auf der Fensterbank", "Verspieltes Kätzchen", "Springende Katze", "Zusammengerollte schlafende Katze",
    "Prinzessin mit Krone", "Prinzessin im Schlossturm", "Prinzessin mit Zauberstab", "Prinzessin tanzt auf dem Ball", "Prinzessin im Zauberwald", "Prinzessin und Drache", "Prinzessin reitet auf einem Pferd",
    "Meerjungfrau sitzt auf einem Felsen", "Meerjungfrau mit Delfin", "Meerjungfrau mit Perle", "Meerjungfrau mit langen, wehenden Haaren", "Meerjungfrau mit Meerestieren", "Meerjungfrau schwimmt unter Wasser", "Kleine Meerjungfrau am Korallenriff",
    "Rakete fliegt an Planeten vorbei", "Rakete startet ins All", "Rakete und Sternschnuppen", "Kleine Rakete mit Triebwerksflammen", "Rakete mit Astronautenfenster", "Süße Rakete", "Rakete landet auf dem Mond",
  ],
  fr: [
    "Dragon survolant les montagnes", "Adorable bébé dragon", "Petit dragon gentil", "Dragon gardant un trésor", "Dragon aux ailes déployées", "Dragon endormi en boule", "Dragon crachant du feu",
    "Licorne à la crinière arc-en-ciel", "Licorne magique dans un pré", "Licorne au galop", "Licorne avec des fleurs", "Licorne dans une forêt enchantée", "Licorne sautant par-dessus l’arc-en-ciel", "Bébé licorne qui joue",
    "Papillon aux ailes géométriques", "Papillon sur une fleur", "Papillon monarque", "Papillon sortant de son cocon", "Deux papillons qui volent", "Papillon dans un jardin", "Papillon coloré aux grandes ailes",
    "Tricératops gentil", "Bébé dinosaure sortant de l’œuf", "Vélociraptor qui court", "Ptérodactyle en vol", "Stégosaure au dos épineux", "Brachiosaure au long cou", "Bébé T-Rex",
    "Chaton jouant avec une pelote de laine", "Chat tout doux assis", "Chat chassant un papillon", "Chat sur le rebord de la fenêtre", "Chaton joueur", "Chat qui saute", "Chat endormi en boule",
    "Princesse avec une couronne", "Princesse dans la tour du château", "Princesse avec une baguette magique", "Princesse dansant au bal", "Princesse dans une forêt magique", "Princesse et dragon", "Princesse à cheval",
    "Sirène assise sur un rocher", "Sirène avec un dauphin", "Sirène tenant une perle", "Sirène aux longs cheveux flottants", "Sirène et créatures marines", "Sirène nageant sous l’eau", "Bébé sirène explorant le récif de corail",
    "Fusée passant près des planètes", "Fusée décollant vers l’espace", "Fusée et étoiles filantes", "Petite fusée et ses flammes", "Fusée avec un hublot d’astronaute", "Jolie petite fusée", "Fusée se posant sur la Lune",
  ],
  es: [
    "Dragón volando sobre las montañas", "Bebé dragón adorable", "Dragoncito amistoso", "Dragón guardando un tesoro", "Dragón con las alas abiertas", "Dragón dormido enroscado", "Dragón que escupe fuego",
    "Unicornio con crin de arcoíris", "Unicornio mágico en la pradera", "Unicornio corriendo", "Unicornio con flores", "Unicornio en un bosque encantado", "Unicornio saltando sobre el arcoíris", "Bebé unicornio jugando",
    "Mariposa con alas geométricas", "Mariposa sobre una flor", "Mariposa monarca", "Mariposa saliendo del capullo", "Dos mariposas volando", "Mariposa en el jardín", "Mariposa colorida de alas grandes",
    "Triceratops amistoso", "Bebé dinosaurio saliendo del huevo", "Velociraptor corriendo", "Pterodáctilo volando", "Estegosaurio con púas en el lomo", "Braquiosaurio de cuello largo", "Bebé T-Rex",
    "Gatito jugando con un ovillo de lana", "Gato peludito sentado", "Gato persiguiendo una mariposa", "Gato en la ventana", "Gatito juguetón", "Gato saltando", "Gato dormido enroscado",
    "Princesa con corona", "Princesa en la torre del castillo", "Princesa con varita mágica", "Princesa bailando en el baile", "Princesa en un bosque mágico", "Princesa y dragón", "Princesa montando a caballo",
    "Sirena sentada en una roca", "Sirena con un delfín", "Sirena con una perla", "Sirena de pelo largo al viento", "Sirena con criaturas marinas", "Sirena nadando bajo el agua", "Sirenita explorando el arrecife de coral",
    "Cohete pasando junto a los planetas", "Cohete despegando al espacio", "Cohete y estrellas fugaces", "Cohete pequeño con llamas", "Cohete con ventanilla de astronauta", "Cohete adorable", "Cohete aterrizando en la Luna",
  ],
  pt: [
    "Dragão voando sobre as montanhas", "Filhote de dragão fofo", "Dragãozinho amigável", "Dragão guardando um tesouro", "Dragão de asas abertas", "Dragão dormindo enroladinho", "Dragão cuspindo fogo",
    "Unicórnio com crina de arco-íris", "Unicórnio mágico no campo", "Unicórnio correndo", "Unicórnio com flores", "Unicórnio na floresta encantada", "Unicórnio pulando o arco-íris", "Filhote de unicórnio brincando",
    "Borboleta com asas geométricas", "Borboleta em uma flor", "Borboleta-monarca", "Borboleta saindo do casulo", "Duas borboletas voando", "Borboleta no jardim", "Borboleta colorida de asas grandes",
    "Tricerátopo amigável", "Filhote de dinossauro saindo do ovo", "Velociraptor correndo", "Pterodáctilo voando", "Estegossauro com espinhos nas costas", "Braquiossauro de pescoço comprido", "Filhote de T-Rex",
    "Gatinho brincando com novelo de lã", "Gato fofinho sentado", "Gato correndo atrás de uma borboleta", "Gato na janela", "Gatinho brincalhão", "Gato pulando", "Gato dormindo enroladinho",
    "Princesa com coroa", "Princesa na torre do castelo", "Princesa com varinha mágica", "Princesa dançando no baile", "Princesa na floresta mágica", "Princesa e dragão", "Princesa andando a cavalo",
    "Sereia sentada em uma pedra", "Sereia com um golfinho", "Sereia segurando uma pérola", "Sereia de cabelos longos e soltos", "Sereia com criaturas do mar", "Sereia nadando debaixo d’água", "Sereiazinha explorando o recife de coral",
    "Foguete passando pelos planetas", "Foguete decolando para o espaço", "Foguete e estrelas cadentes", "Foguetinho com chamas nos propulsores", "Foguete com janela de astronauta", "Foguete fofo", "Foguete pousando na Lua",
  ],
  ru: [
    "Дракон летит над горами", "Милый дракончик", "Маленький добрый дракон", "Дракон охраняет сокровище", "Дракон с расправленными крыльями", "Дракон спит, свернувшись клубком", "Огнедышащий дракон",
    "Единорог с радужной гривой", "Волшебный единорог на лугу", "Бегущий единорог", "Единорог с цветами", "Единорог в волшебном лесу", "Единорог прыгает через радугу", "Маленький единорог играет",
    "Бабочка с геометрическими крыльями", "Бабочка на цветке", "Бабочка-монарх", "Бабочка выбирается из кокона", "Две летящие бабочки", "Бабочка в саду", "Яркая бабочка с большими крыльями",
    "Добрый трицератопс", "Динозаврик вылупляется из яйца", "Бегущий велоцираптор", "Летящий птеродактиль", "Стегозавр с шипами на спине", "Длинношеий брахиозавр", "Малыш тираннозавр",
    "Котёнок играет с клубком", "Пушистая кошка сидит", "Кошка гонится за бабочкой", "Кошка на подоконнике", "Игривый котёнок", "Кошка в прыжке", "Кошка спит, свернувшись клубком",
    "Принцесса с короной", "Принцесса в башне замка", "Принцесса с волшебной палочкой", "Принцесса танцует на балу", "Принцесса в волшебном лесу", "Принцесса и дракон", "Принцесса верхом на лошади",
    "Русалка сидит на скале", "Русалка с дельфином", "Русалка с жемчужиной", "Русалка с длинными развевающимися волосами", "Русалка с морскими обитателями", "Русалка плывёт под водой", "Маленькая русалка у кораллового рифа",
    "Ракета летит мимо планет", "Ракета взлетает в космос", "Ракета и падающие звёзды", "Маленькая ракета с огнём из двигателей", "Ракета с иллюминатором", "Милая ракета", "Ракета садится на Луну",
  ],
  it: [
    "Drago che vola sopra le montagne", "Tenero cucciolo di drago", "Draghetto amichevole", "Drago che custodisce un tesoro", "Drago con le ali spiegate", "Drago che dorme acciambellato", "Drago sputafuoco",
    "Unicorno con la criniera arcobaleno", "Unicorno magico nel prato", "Unicorno al galoppo", "Unicorno con i fiori", "Unicorno nel bosco incantato", "Unicorno che salta l’arcobaleno", "Cucciolo di unicorno che gioca",
    "Farfalla con ali geometriche", "Farfalla su un fiore", "Farfalla monarca", "Farfalla che esce dal bozzolo", "Due farfalle in volo", "Farfalla in giardino", "Farfalla colorata con grandi ali",
    "Triceratopo amichevole", "Cucciolo di dinosauro che esce dall’uovo", "Velociraptor che corre", "Pterodattilo in volo", "Stegosauro con la schiena a punte", "Brachiosauro dal collo lungo", "Cucciolo di T-Rex",
    "Gattino che gioca con un gomitolo", "Gatto soffice seduto", "Gatto che insegue una farfalla", "Gatto sul davanzale", "Gattino giocherellone", "Gatto che salta", "Gatto che dorme acciambellato",
    "Principessa con la corona", "Principessa nella torre del castello", "Principessa con la bacchetta magica", "Principessa che balla al ballo", "Principessa nel bosco magico", "Principessa e drago", "Principessa a cavallo",
    "Sirena seduta su uno scoglio", "Sirena con un delfino", "Sirena con una perla", "Sirena con lunghi capelli fluenti", "Sirena con le creature marine", "Sirena che nuota sott’acqua", "Sirenetta che esplora la barriera corallina",
    "Razzo che vola tra i pianeti", "Razzo che parte per lo spazio", "Razzo e stelle cadenti", "Piccolo razzo con le fiamme dei motori", "Razzo con l’oblò dell’astronauta", "Razzo carino", "Razzo che atterra sulla Luna",
  ],
  nl: [
    "Draak vliegt over de bergen", "Schattig drakenjong", "Kleine vriendelijke draak", "Draak bewaakt een schat", "Draak met gespreide vleugels", "Opgerolde slapende draak", "Vuurspuwende draak",
    "Eenhoorn met regenboogmanen", "Magische eenhoorn in de wei", "Rennende eenhoorn", "Eenhoorn met bloemen", "Eenhoorn in een betoverd bos", "Eenhoorn springt over de regenboog", "Spelend eenhoornveulen",
    "Vlinder met geometrische vleugels", "Vlinder op een bloem", "Monarchvlinder", "Vlinder komt uit de cocon", "Twee vliegende vlinders", "Vlinder in de tuin", "Kleurige vlinder met grote vleugels",
    "Vriendelijke triceratops", "Dinojong komt uit het ei", "Rennende velociraptor", "Vliegende pterodactylus", "Stegosaurus met stekelrug", "Brachiosaurus met lange nek", "Baby-T-rex",
    "Kitten speelt met een bolletje wol", "Pluizige kat zit", "Kat jaagt op een vlinder", "Kat op de vensterbank", "Speels kitten", "Springende kat", "Opgerolde slapende kat",
    "Prinses met kroon", "Prinses in de kasteeltoren", "Prinses met toverstaf", "Prinses danst op het bal", "Prinses in een toverbos", "Prinses en draak", "Prinses te paard",
    "Zeemeermin zit op een rots", "Zeemeermin met een dolfijn", "Zeemeermin met een parel", "Zeemeermin met lang golvend haar", "Zeemeermin met zeedieren", "Zeemeermin zwemt onder water", "Kleine zeemeermin bij het koraalrif",
    "Raket vliegt langs planeten", "Raket stijgt op naar de ruimte", "Raket en vallende sterren", "Kleine raket met vlammende motoren", "Raket met astronautenraampje", "Schattige raket", "Raket landt op de maan",
  ],
  pl: [
    "Smok lecący nad górami", "Słodki mały smok", "Mały przyjazny smok", "Smok strzegący skarbu", "Smok z rozpostartymi skrzydłami", "Smok śpiący zwinięty w kłębek", "Smok ziejący ogniem",
    "Jednorożec z tęczową grzywą", "Magiczny jednorożec na łące", "Biegnący jednorożec", "Jednorożec z kwiatami", "Jednorożec w zaczarowanym lesie", "Jednorożec skaczący przez tęczę", "Mały jednorożec w zabawie",
    "Motyl z geometrycznymi skrzydłami", "Motyl na kwiatku", "Motyl monarcha", "Motyl wychodzący z kokonu", "Dwa latające motyle", "Motyl w ogrodzie", "Kolorowy motyl z dużymi skrzydłami",
    "Przyjazny triceratops", "Mały dinozaur wykluwający się z jaja", "Biegnący welociraptor", "Lecący pterodaktyl", "Stegozaur z kolcami na grzbiecie", "Brachiozaur z długą szyją", "Mały T-Rex",
    "Kotek bawiący się włóczką", "Puszysty kot siedzi", "Kot goniący motyla", "Kot na parapecie", "Wesoły kotek", "Skaczący kot", "Kot śpiący zwinięty w kłębek",
    "Księżniczka w koronie", "Księżniczka w wieży zamku", "Księżniczka z czarodziejską różdżką", "Księżniczka tańcząca na balu", "Księżniczka w zaczarowanym lesie", "Księżniczka i smok", "Księżniczka na koniu",
    "Syrenka siedząca na skale", "Syrenka z delfinem", "Syrenka trzymająca perłę", "Syrenka z długimi, rozwianymi włosami", "Syrenka z morskimi stworzeniami", "Syrenka pływająca pod wodą", "Mała syrenka na rafie koralowej",
    "Rakieta lecąca obok planet", "Rakieta startująca w kosmos", "Rakieta i spadające gwiazdy", "Mała rakieta z płomieniami silników", "Rakieta z okienkiem astronauty", "Słodka rakieta", "Rakieta lądująca na Księżycu",
  ],
  tr: [
    "Dağların üzerinde uçan ejderha", "Sevimli yavru ejderha", "Küçük, dost canlısı ejderha", "Hazineyi koruyan ejderha", "Kanatlarını açmış ejderha", "Kıvrılıp uyuyan ejderha", "Ateş püskürten ejderha",
    "Gökkuşağı yeleli tek boynuzlu at", "Çayırda büyülü tek boynuzlu at", "Koşan tek boynuzlu at", "Çiçekli tek boynuzlu at", "Büyülü ormanda tek boynuzlu at", "Gökkuşağının üzerinden atlayan tek boynuzlu at", "Oyun oynayan yavru tek boynuzlu at",
    "Geometrik kanatlı kelebek", "Çiçeğe konmuş kelebek", "Kral kelebeği", "Kozasından çıkan kelebek", "Uçan iki kelebek", "Bahçedeki kelebek", "Büyük kanatlı rengârenk kelebek",
    "Dost canlısı triceratops", "Yumurtadan çıkan sevimli dinozor", "Koşan velociraptor", "Uçan pterodaktil", "Sırtı dikenli stegosaurus", "Uzun boyunlu brakiyozor", "Yavru T-Rex",
    "Yün yumağıyla oynayan yavru kedi", "Oturan tüylü kedi", "Kelebek kovalayan kedi", "Pencere kenarındaki kedi", "Oyuncu yavru kedi", "Zıplayan kedi", "Kıvrılıp uyuyan kedi",
    "Taçlı prenses", "Şato kulesindeki prenses", "Sihirli değnekli prenses", "Baloda dans eden prenses", "Büyülü ormandaki prenses", "Prenses ve ejderha", "Ata binen prenses",
    "Kayanın üzerinde oturan deniz kızı", "Yunuslu deniz kızı", "İnci tutan deniz kızı", "Uzun dalgalı saçlı deniz kızı", "Deniz canlılarıyla deniz kızı", "Su altında yüzen deniz kızı", "Mercan resifini keşfeden minik deniz kızı",
    "Gezegenlerin yanından geçen roket", "Uzaya fırlayan roket", "Roket ve kayan yıldızlar", "Motorlarından alev çıkan küçük roket", "Astronot pencereli roket", "Sevimli roket", "Aya inen roket",
  ],
  zh: [
    "飞越群山的龙", "可爱的小龙宝宝", "友善的小龙", "守护宝藏的龙", "展开翅膀的龙", "蜷着睡觉的龙", "喷火龙",
    "彩虹鬃毛的独角兽", "草地上的魔法独角兽", "奔跑的独角兽", "带着花朵的独角兽", "魔法森林里的独角兽", "跃过彩虹的独角兽", "玩耍的独角兽宝宝",
    "几何图案翅膀的蝴蝶", "花朵上的蝴蝶", "帝王蝶", "破茧而出的蝴蝶", "两只飞舞的蝴蝶", "花园里的蝴蝶", "大翅膀的彩色蝴蝶",
    "友善的三角龙", "破壳而出的恐龙宝宝", "奔跑的迅猛龙", "飞翔的翼龙", "背上长刺的剑龙", "长脖子腕龙", "霸王龙宝宝",
    "玩毛线球的小猫", "坐着的毛茸茸猫咪", "追蝴蝶的猫", "窗台上的猫", "顽皮的小猫", "跳跃的猫", "蜷着睡觉的猫",
    "戴王冠的公主", "城堡塔楼里的公主", "拿魔法棒的公主", "在舞会上跳舞的公主", "魔法森林里的公主", "公主和龙", "骑马的公主",
    "坐在礁石上的美人鱼", "美人鱼和海豚", "捧着珍珠的美人鱼", "长发飘飘的美人鱼", "美人鱼和海洋动物", "在水下游泳的美人鱼", "探索珊瑚礁的小美人鱼",
    "飞过行星的火箭", "发射升空的火箭", "火箭和流星", "喷着火焰的小火箭", "带宇航员舷窗的火箭", "可爱的火箭", "登陆月球的火箭",
  ],
  hi: [
    "पहाड़ों के ऊपर उड़ता ड्रैगन", "प्यारा बेबी ड्रैगन", "छोटा दोस्ताना ड्रैगन", "खज़ाने की रखवाली करता ड्रैगन", "पंख फैलाए ड्रैगन", "गोल-मोल होकर सोता ड्रैगन", "आग उगलता ड्रैगन",
    "इंद्रधनुषी अयाल वाला यूनिकॉर्न", "घास के मैदान में जादुई यूनिकॉर्न", "दौड़ता यूनिकॉर्न", "फूलों के साथ यूनिकॉर्न", "जादुई जंगल में यूनिकॉर्न", "इंद्रधनुष के ऊपर से कूदता यूनिकॉर्न", "खेलता हुआ बेबी यूनिकॉर्न",
    "ज्यामितीय पंखों वाली तितली", "फूल पर बैठी तितली", "मोनार्क तितली", "कोकून से निकलती तितली", "उड़ती हुई दो तितलियाँ", "बगीचे में तितली", "बड़े पंखों वाली रंग-बिरंगी तितली",
    "दोस्ताना ट्राइसेराटॉप्स", "अंडे से निकलता प्यारा डायनासोर", "दौड़ता वेलोसिरैप्टर", "उड़ता टेरोडैक्टिल", "काँटेदार पीठ वाला स्टेगोसॉरस", "लंबी गर्दन वाला ब्रैकियोसॉरस", "बेबी टी-रेक्स",
    "ऊन के गोले से खेलता बिल्ली का बच्चा", "बैठी हुई रोएँदार बिल्ली", "तितली के पीछे भागती बिल्ली", "खिड़की पर बैठी बिल्ली", "नटखट बिल्ली का बच्चा", "कूदती हुई बिल्ली", "गोल-मोल होकर सोती बिल्ली",
    "मुकुट पहने राजकुमारी", "महल की मीनार में राजकुमारी", "जादुई छड़ी वाली राजकुमारी", "नृत्य-समारोह में नाचती राजकुमारी", "जादुई जंगल में राजकुमारी", "राजकुमारी और ड्रैगन", "घोड़े पर सवार राजकुमारी",
    "चट्टान पर बैठी जलपरी", "डॉल्फ़िन के साथ जलपरी", "मोती पकड़े जलपरी", "लंबे लहराते बालों वाली जलपरी", "समुद्री जीवों के साथ जलपरी", "पानी के नीचे तैरती जलपरी", "मूँगे की चट्टान पर घूमती नन्ही जलपरी",
    "ग्रहों के पास से उड़ता रॉकेट", "अंतरिक्ष की ओर उड़ान भरता रॉकेट", "रॉकेट और टूटते तारे", "लपटें छोड़ता छोटा रॉकेट", "अंतरिक्ष यात्री की खिड़की वाला रॉकेट", "प्यारा रॉकेट", "चाँद पर उतरता रॉकेट",
  ],
};

const SUBJECT_LABELS = {};
function addLabels(table, subjects, name) {
  for (const [lang, labels] of Object.entries(table)) {
    if (labels.length !== subjects.length) throw new Error(`subject-labels: ${lang} has ${labels.length} ${name} labels, need ${subjects.length}`);
    Object.assign(SUBJECT_LABELS[lang] ||= {}, Object.fromEntries(subjects.map((s, i) => [s, labels[i]])));
  }
}
addLabels(CAR_LABELS, CAR, "car");
addLabels(EVERGREEN_LABELS, EVERGREEN, "evergreen");
// Christmas & winter topics (lib/seasonal-topics.js).
for (const [lang, labels] of Object.entries(require("./seasonal-topics").SUBJECT_LABELS)) Object.assign(SUBJECT_LABELS[lang] ||= {}, labels);

module.exports = { SUBJECT_LABELS, EVERGREEN };
