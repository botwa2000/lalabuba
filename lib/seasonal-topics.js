"use strict";
// Christmas & winter topics with a page in every language (growth plan L1, 2026-11).
// Pure data: slugs, names, page headings, intros and picture labels. Wired in by
// gallery.js (TOPIC_META), coloring-i18n.js (slugs, names, page strings) and
// topic-nav.js (URLs). Nikolaus and the school topics stay German-only.
// Pictures: no subject may need rendered text or digits (AI lettering is mangled).

const L = ["en", "de", "fr", "es", "pt", "ru", "it", "nl", "pl", "tr", "zh", "hi"];
const row = (a) => {
  if (a.length !== L.length) throw new Error(`seasonal-topics: row needs ${L.length} languages, got ${a.length}: ${a[0]}`);
  return Object.fromEntries(L.map((l, i) => [l, a[i]]));
};

// German pages of weihnachten / schneemann / adventskalender are static HTML
// (public/ausmalbilder/<slug>/) with their own text, so their `de` h1/intro is null.
const TOPICS = {
  weihnachten: {
    slug: row(["christmas", "weihnachten", "noel", "navidad", "natal", "novyy-god", "natale", "kerst", "boze-narodzenie", "yilbasi", "shengdan", "christmas"]),
    name: row(["Christmas", "Weihnachten", "Noël", "Navidad", "Natal", "Новый год", "Natale", "Kerst", "Boże Narodzenie", "Yılbaşı", "圣诞节", "क्रिसमस"]),
    h1: row(["Christmas Coloring Pages", null, "Coloriages de Noël", "Dibujos de Navidad para colorear", "Desenhos de Natal para colorir", "Новогодние раскраски", "Disegni di Natale da colorare", "Kerstkleurplaten", "Kolorowanki świąteczne", "Yılbaşı Boyama Sayfaları", "圣诞节涂色页", "क्रिसमस रंग भरने के चित्र"]),
    intro: row([
      "Christmas trees, Santa with his sack, reindeer, angels and gingerbread houses: pick a picture and color it right here, or print it for the holidays. Easy pages suit little ones, hard pages keep older kids busy until Christmas Eve.",
      null,
      "Sapins, Père Noël et sa hotte, rennes, anges et maisons en pain d'épices : choisis un dessin et colorie-le ici, ou imprime-le pour les fêtes. Les dessins faciles conviennent aux petits, les difficiles occupent les grands jusqu'au réveillon.",
      "Árboles de Navidad, Papá Noel con su saco, renos, ángeles y casitas de jengibre: elige un dibujo y coloréalo aquí mismo, o imprímelo para las fiestas. Los fáciles son para los peques; los difíciles entretienen a los mayores hasta Nochebuena.",
      "Árvores de Natal, Papai Noel com o saco de presentes, renas, anjos e casinhas de gengibre: escolha um desenho e pinte aqui mesmo, ou imprima para as festas. Os fáceis são para os pequenos; os difíceis distraem os maiores até a véspera de Natal.",
      "Ёлки, Санта с мешком подарков, олени, ангелы и пряничные домики: выбери картинку и раскрась её прямо здесь или распечатай к празднику. Лёгкие раскраски подойдут малышам, сложные займут ребят постарше до самого Нового года.",
      "Alberi addobbati, Babbo Natale con il sacco, renne, angeli e casette di pan di zenzero: scegli un disegno e coloralo qui, oppure stampalo per le feste. I facili sono per i più piccoli, i difficili tengono occupati i grandi fino alla Vigilia.",
      "Kerstbomen, de Kerstman met zijn zak, rendieren, engelen en peperkoekhuisjes: kies een plaat en kleur hem hier, of print hem voor de feestdagen. Makkelijke platen zijn voor de kleintjes, moeilijke houden grotere kinderen bezig tot kerstavond.",
      "Choinki, Mikołaj z workiem prezentów, renifery, aniołki i piernikowe domki: wybierz obrazek i pokoloruj go tutaj albo wydrukuj na święta. Łatwe są dla maluchów, trudne zajmą starsze dzieci aż do Wigilii.",
      "Yılbaşı ağaçları, hediye çuvallı Noel Baba, ren geyikleri, melekler ve zencefilli kurabiye evleri: bir resim seç, burada boya ya da yazdırıp tatilde boya. Kolay resimler minikler için, zor olanlar büyükleri yeni yıla kadar oyalar.",
      "圣诞树、背着礼物袋的圣诞老人、驯鹿、天使和姜饼屋：挑一张图，直接在这里涂色，或者打印出来过节。简单的适合小朋友，难的能让大孩子一直玩到平安夜。",
      "क्रिसमस ट्री, उपहारों की थैली वाले सांता, रेनडियर, फ़रिश्ते और जिंजरब्रेड घर: कोई चित्र चुनें और यहीं रंग भरें, या छुट्टियों के लिए प्रिंट करें। आसान चित्र छोटे बच्चों के लिए हैं, कठिन चित्र बड़े बच्चों को क्रिसमस तक व्यस्त रखेंगे।",
    ]),
  },
  schneemann: {
    slug: row(["snowman", "schneemann", "bonhomme-de-neige", "muneco-de-nieve", "boneco-de-neve", "snegovik", "pupazzo-di-neve", "sneeuwpop", "balwan", "kardan-adam", "xueren", "snowman"]),
    name: row(["Snowman", "Schneemann", "Bonhomme de neige", "Muñeco de nieve", "Boneco de neve", "Снеговик", "Pupazzo di neve", "Sneeuwpop", "Bałwan", "Kardan Adam", "雪人", "स्नोमैन"]),
    h1: row(["Snowman Coloring Pages", null, "Coloriages bonhomme de neige", "Dibujos de muñeco de nieve para colorear", "Desenhos de boneco de neve para colorir", "Раскраски снеговик", "Disegni di pupazzo di neve da colorare", "Sneeuwpop kleurplaten", "Kolorowanki bałwan", "Kardan Adam Boyama", "雪人涂色页", "स्नोमैन रंग भरने के चित्र"]),
    intro: row([
      "Snowmen with top hats, carrot noses and scarves, a whole snowman family and even one on ice skates. Color them online with a tap, or print a few for a cozy winter afternoon.",
      null,
      "Des bonshommes de neige avec chapeau, nez en carotte et écharpe, toute une famille et même un patineur sur glace. Colorie-les en ligne d'un geste, ou imprime-les pour un après-midi d'hiver bien au chaud.",
      "Muñecos de nieve con sombrero de copa, nariz de zanahoria y bufanda, toda una familia y hasta uno patinando sobre hielo. Coloréalos en línea con un toque o imprime algunos para una tarde de invierno en casa.",
      "Bonecos de neve com cartola, nariz de cenoura e cachecol, uma família inteira e até um patinando no gelo. Pinte online com um toque ou imprima alguns para uma tarde de inverno aconchegante.",
      "Снеговики в цилиндрах, с морковкой вместо носа и в шарфах, целая снежная семья и даже снеговик на коньках. Раскрась их онлайн одним касанием или распечатай для уютного зимнего вечера.",
      "Pupazzi di neve con cilindro, naso di carota e sciarpa, un'intera famiglia e persino uno sui pattini. Colorali online con un tocco o stampane qualcuno per un pomeriggio d'inverno al calduccio.",
      "Sneeuwpoppen met een hoge hoed, wortelneus en sjaal, een hele sneeuwpoppenfamilie en zelfs eentje op schaatsen. Kleur ze online met één tik, of print er een paar voor een gezellige wintermiddag.",
      "Bałwanki w cylindrach, z marchewkowym nosem i szalikiem, cała bałwankowa rodzina, a nawet jeden na łyżwach. Pokoloruj je online jednym dotknięciem albo wydrukuj na przytulne zimowe popołudnie.",
      "Silindir şapkalı, havuç burunlu ve atkılı kardan adamlar, koca bir kardan adam ailesi, hatta paten kayan biri. Tek dokunuşla çevrimiçi boya ya da sıcacık bir kış öğleden sonrası için yazdır.",
      "戴礼帽、胡萝卜鼻子、围着围巾的雪人，一整个雪人家庭，还有一个在滑冰呢。轻轻一点就能在线涂色，也可以打印几张，度过温暖的冬日午后。",
      "टोपी, गाजर की नाक और मफ़लर वाले स्नोमैन, पूरा स्नोमैन परिवार और बर्फ़ पर स्केटिंग करता एक स्नोमैन भी। एक टैप में ऑनलाइन रंग भरें, या सर्दियों की दोपहर के लिए कुछ चित्र प्रिंट करें।",
    ]),
  },
  adventskalender: {
    slug: row(["advent-calendar", "adventskalender", "calendrier-avent", "calendario-adviento", "calendario-advento", "advent-kalendar", "calendario-avvento", "adventskalender", "kalendarz-adwentowy", "advent-takvimi", "jiangjieli", "advent-calendar"]),
    name: row(["Advent Calendar", "Adventskalender", "Calendrier de l'Avent", "Calendario de Adviento", "Calendário do Advento", "Адвент-календарь", "Calendario dell'Avvento", "Adventskalender", "Kalendarz adwentowy", "Advent Takvimi", "降临节日历", "एडवेंट कैलेंडर"]),
    h1: row(["Advent Calendar Coloring Pages", null, "Coloriages calendrier de l'Avent", "Dibujos de calendario de Adviento", "Desenhos de calendário do Advento", "Раскраски для адвент-календаря", "Disegni per il calendario dell'Avvento", "Adventskalender kleurplaten", "Kolorowanki do kalendarza adwentowego", "Advent Takvimi Boyama", "降临节日历涂色页", "एडवेंट कैलेंडर रंग भरने के चित्र"]),
    intro: row([
      "Little pictures for every day before Christmas: candles, cookies, stars, presents and winter animals. Print one a day for a homemade Advent calendar, or color them online.",
      null,
      "De petits dessins pour chaque jour avant Noël : bougies, biscuits, étoiles, cadeaux et animaux de l'hiver. Imprime-en un par jour pour un calendrier de l'Avent fait maison, ou colorie-les en ligne.",
      "Pequeños dibujos para cada día antes de Navidad: velas, galletas, estrellas, regalos y animales del invierno. Imprime uno al día para un calendario de Adviento casero o coloréalos en línea.",
      "Desenhos pequenos para cada dia antes do Natal: velas, biscoitos, estrelas, presentes e bichinhos do inverno. Imprima um por dia para um calendário do Advento caseiro ou pinte online.",
      "Маленькие картинки на каждый день до праздника: свечи, печенье, звёзды, подарки и зимние зверята. Распечатывай по одной в день для самодельного адвент-календаря или раскрашивай онлайн.",
      "Piccoli disegni per ogni giorno prima di Natale: candele, biscotti, stelle, regali e animali dell'inverno. Stampane uno al giorno per un calendario dell'Avvento fatto in casa, o colorali online.",
      "Kleine plaatjes voor elke dag tot Kerstmis: kaarsjes, koekjes, sterren, cadeautjes en winterdieren. Print er elke dag één voor een zelfgemaakte adventskalender, of kleur ze online.",
      "Małe obrazki na każdy dzień przed świętami: świeczki, ciasteczka, gwiazdki, prezenty i zimowe zwierzątka. Drukuj jeden dziennie do domowego kalendarza adwentowego albo koloruj online.",
      "Noel'e kadar her gün için küçük resimler: mumlar, kurabiyeler, yıldızlar, hediyeler ve kış hayvanları. Evde yapılmış bir advent takvimi için her gün bir tane yazdır ya da çevrimiçi boya.",
      "圣诞前每天一张小图：蜡烛、饼干、星星、礼物和冬天的小动物。每天打印一张，做一个自制的降临节日历，或者直接在线涂色。",
      "क्रिसमस से पहले हर दिन के लिए छोटे चित्र: मोमबत्तियाँ, कुकीज़, तारे, उपहार और सर्दियों के जानवर। घर पर बने एडवेंट कैलेंडर के लिए रोज़ एक प्रिंट करें, या ऑनलाइन रंग भरें।",
    ]),
  },
  christmastree: {
    slug: row(["christmas-tree", "weihnachtsbaum", "sapin-de-noel", "arbol-de-navidad", "arvore-de-natal", "yolka", "albero-di-natale", "kerstboom", "choinka", "yilbasi-agaci", "shengdanshu", "christmas-tree"]),
    name: row(["Christmas Tree", "Weihnachtsbaum", "Sapin de Noël", "Árbol de Navidad", "Árvore de Natal", "Ёлка", "Albero di Natale", "Kerstboom", "Choinka", "Yılbaşı Ağacı", "圣诞树", "क्रिसमस ट्री"]),
    h1: row(["Christmas Tree Coloring Pages", "Ausmalbilder Weihnachtsbaum", "Coloriages sapin de Noël", "Dibujos de árbol de Navidad para colorear", "Desenhos de árvore de Natal para colorir", "Раскраски новогодняя ёлка", "Disegni di albero di Natale da colorare", "Kerstboom kleurplaten", "Kolorowanki choinka", "Yılbaşı Ağacı Boyama", "圣诞树涂色页", "क्रिसमस ट्री रंग भरने के चित्र"]),
    intro: row([
      "Christmas trees with baubles, garlands and a star on top, by a fireplace or deep in a snowy forest. Decorate your own tree in any colors you like, online or on paper.",
      "Weihnachtsbäume mit Kugeln, Girlanden und Stern auf der Spitze – am Kamin oder mitten im verschneiten Wald. Schmück deinen eigenen Baum in deinen Lieblingsfarben, online oder auf Papier.",
      "Des sapins avec boules, guirlandes et étoile au sommet, près de la cheminée ou au fond d'une forêt enneigée. Décore ton propre sapin avec les couleurs que tu aimes, en ligne ou sur papier.",
      "Árboles con bolas, guirnaldas y una estrella en la punta, junto a la chimenea o en un bosque nevado. Decora tu propio árbol con los colores que quieras, en línea o en papel.",
      "Árvores com bolas, guirlandas e uma estrela no topo, perto da lareira ou numa floresta com neve. Enfeite a sua própria árvore com as cores que quiser, online ou no papel.",
      "Ёлки с шарами, гирляндами и звездой на макушке — у камина или в заснеженном лесу. Наряди свою ёлку в любимые цвета онлайн или на бумаге.",
      "Alberi con palline, ghirlande e una stella in cima, vicino al camino o in un bosco innevato. Addobba il tuo albero con i colori che preferisci, online o su carta.",
      "Kerstbomen met ballen, slingers en een ster in de top, bij de open haard of diep in een besneeuwd bos. Versier je eigen boom in je lievelingskleuren, online of op papier.",
      "Choinki z bombkami, łańcuchami i gwiazdą na czubku, przy kominku albo w zaśnieżonym lesie. Ubierz własną choinkę w ulubione kolory, online lub na papierze.",
      "Süslerle, girlandlarla ve tepesinde yıldızla yılbaşı ağaçları; şöminenin yanında ya da karlı bir ormanda. Kendi ağacını istediğin renklerle süsle, çevrimiçi ya da kâğıtta.",
      "挂满彩球、彩带，顶上有颗星星的圣诞树，有的在壁炉旁，有的在雪林深处。用你喜欢的颜色装扮自己的圣诞树，在线或纸上都可以。",
      "गेंदों, मालाओं और ऊपर तारे वाले क्रिसमस ट्री, अंगीठी के पास या बर्फ़ीले जंगल में। अपना पेड़ अपने पसंदीदा रंगों से सजाएँ, ऑनलाइन या कागज़ पर।",
    ]),
  },
  santa: {
    slug: row(["santa", "weihnachtsmann", "pere-noel", "papa-noel", "papai-noel", "santa-klaus", "babbo-natale", "kerstman", "mikolaj", "noel-baba", "shengdan-laoren", "santa-claus"]),
    name: row(["Santa Claus", "Weihnachtsmann", "Père Noël", "Papá Noel", "Papai Noel", "Санта-Клаус", "Babbo Natale", "Kerstman", "Mikołaj", "Noel Baba", "圣诞老人", "सांता क्लॉज़"]),
    h1: row(["Santa Claus Coloring Pages", "Ausmalbilder Weihnachtsmann", "Coloriages Père Noël", "Dibujos de Papá Noel para colorear", "Desenhos de Papai Noel para colorir", "Раскраски Санта-Клаус", "Disegni di Babbo Natale da colorare", "Kerstman kleurplaten", "Kolorowanki Mikołaj", "Noel Baba Boyama", "圣诞老人涂色页", "सांता क्लॉज़ रंग भरने के चित्र"]),
    intro: row([
      "Santa Claus waving, flying his sleigh over the rooftops, climbing down the chimney or wrapping presents with his elves. Choose a Santa, color him online or print him out.",
      "Der Weihnachtsmann winkt, fliegt mit dem Schlitten über die Dächer, klettert durch den Kamin oder packt mit seinen Elfen Geschenke ein. Such dir einen aus und mal ihn online aus oder druck ihn aus.",
      "Le Père Noël qui salue, survole les toits en traîneau, descend par la cheminée ou emballe les cadeaux avec ses lutins. Choisis ton Père Noël, colorie-le en ligne ou imprime-le.",
      "Papá Noel saludando, volando en su trineo sobre los tejados, bajando por la chimenea o envolviendo regalos con sus duendes. Elige uno y coloréalo en línea o imprímelo.",
      "Papai Noel acenando, voando no trenó sobre os telhados, descendo pela chaminé ou embrulhando presentes com os duendes. Escolha um e pinte online ou imprima.",
      "Санта машет рукой, летит в санях над крышами, спускается по трубе или упаковывает подарки вместе с эльфами. Выбери картинку и раскрась онлайн или распечатай.",
      "Babbo Natale che saluta, vola con la slitta sopra i tetti, scende dal camino o incarta i regali con i suoi elfi. Scegli il tuo e coloralo online o stampalo.",
      "De Kerstman die zwaait, met zijn slee over de daken vliegt, door de schoorsteen klimt of met zijn elfjes cadeautjes inpakt. Kies er een en kleur hem online of print hem uit.",
      "Mikołaj macha na powitanie, leci saniami nad dachami, schodzi przez komin albo pakuje prezenty z elfami. Wybierz obrazek i pokoloruj go online lub wydrukuj.",
      "El sallayan, kızağıyla çatıların üstünden uçan, bacadan inen ya da cücelerle hediye paketleyen Noel Baba. Birini seç, çevrimiçi boya ya da yazdır.",
      "挥手的圣诞老人、驾着雪橇飞过屋顶、从烟囱爬下来，或者和小精灵一起包礼物。选一张，在线涂色或打印出来。",
      "हाथ हिलाते सांता, छतों के ऊपर स्लेज उड़ाते, चिमनी से उतरते या अपने एल्फ़ के साथ उपहार लपेटते हुए। कोई चित्र चुनें, ऑनलाइन रंग भरें या प्रिंट करें।",
    ]),
  },
  reindeer: {
    slug: row(["reindeer", "rentier", "renne", "reno", "rena", "olen", "renna", "rendier", "renifer", "ren-geyigi", "xunlu", "reindeer"]),
    name: row(["Reindeer", "Rentier", "Renne", "Reno", "Rena", "Олень", "Renna", "Rendier", "Renifer", "Ren Geyiği", "驯鹿", "रेनडियर"]),
    h1: row(["Reindeer Coloring Pages", "Ausmalbilder Rentier", "Coloriages renne", "Dibujos de reno para colorear", "Desenhos de rena para colorir", "Раскраски олень", "Disegni di renna da colorare", "Rendier kleurplaten", "Kolorowanki renifer", "Ren Geyiği Boyama", "驯鹿涂色页", "रेनडियर रंग भरने के चित्र"]),
    intro: row([
      "Baby reindeer in the snow, reindeer with big antlers and jingle bells, and two friends playing in the forest. Color them online, or print them for a winter craft.",
      "Ein Rentierbaby im Schnee, Rentiere mit großem Geweih und Glöckchen und zwei Freunde beim Spielen im Wald. Mal sie online aus oder druck sie für eine Winterbastelei aus.",
      "Un bébé renne dans la neige, des rennes aux grands bois et à clochettes, et deux amis qui jouent dans la forêt. Colorie-les en ligne ou imprime-les pour un bricolage d'hiver.",
      "Un reno bebé en la nieve, renos con grandes astas y cascabeles, y dos amigos jugando en el bosque. Coloréalos en línea o imprímelos para una manualidad de invierno.",
      "Um filhote de rena na neve, renas com grandes chifres e sininhos, e duas amigas brincando na floresta. Pinte online ou imprima para um trabalhinho de inverno.",
      "Оленёнок в снегу, олени с большими рогами и колокольчиками и двое друзей, играющих в лесу. Раскрась их онлайн или распечатай для зимней поделки.",
      "Un cucciolo di renna nella neve, renne con grandi corna e campanelli, e due amiche che giocano nel bosco. Colorale online o stampale per un lavoretto invernale.",
      "Een rendierjong in de sneeuw, rendieren met een groot gewei en belletjes, en twee vriendjes die spelen in het bos. Kleur ze online of print ze voor een winterknutsel.",
      "Mały renifer w śniegu, renifery z wielkim porożem i dzwoneczkami oraz dwaj przyjaciele bawiący się w lesie. Pokoloruj je online albo wydrukuj do zimowej pracy plastycznej.",
      "Karda yavru bir ren geyiği, kocaman boynuzlu ve çıngıraklı ren geyikleri, ormanda oynayan iki arkadaş. Çevrimiçi boya ya da bir kış etkinliği için yazdır.",
      "雪地里的小驯鹿、长着大鹿角戴着铃铛的驯鹿，还有在森林里玩耍的两个好朋友。在线涂色，或者打印出来做冬季手工。",
      "बर्फ़ में नन्हा रेनडियर, बड़े सींगों और घंटियों वाले रेनडियर, और जंगल में खेलते दो दोस्त। ऑनलाइन रंग भरें या सर्दियों की क्राफ़्ट के लिए प्रिंट करें।",
    ]),
  },
  christmasangel: {
    slug: row(["christmas-angel", "weihnachtsengel", "ange-de-noel", "angel-de-navidad", "anjo-de-natal", "angel", "angelo-di-natale", "kerstengel", "aniolek", "melek", "tianshi", "farishta"]),
    name: row(["Christmas Angel", "Weihnachtsengel", "Ange de Noël", "Ángel de Navidad", "Anjo de Natal", "Ангел", "Angelo di Natale", "Kerstengel", "Aniołek", "Melek", "天使", "फ़रिश्ता"]),
    h1: row(["Christmas Angel Coloring Pages", "Ausmalbilder Weihnachtsengel", "Coloriages ange de Noël", "Dibujos de ángeles de Navidad para colorear", "Desenhos de anjo de Natal para colorir", "Раскраски ангел", "Disegni di angeli di Natale da colorare", "Kerstengel kleurplaten", "Kolorowanki aniołek", "Melek Boyama", "圣诞天使涂色页", "फ़रिश्ता रंग भरने के चित्र"]),
    intro: row([
      "Little Christmas angels with wings and halos, playing trumpets among the stars, holding candles or sitting on a cloud with a harp. Gentle pictures for quiet coloring before Christmas.",
      "Kleine Weihnachtsengel mit Flügeln und Heiligenschein, die zwischen den Sternen Trompete spielen, Kerzen halten oder mit einer Harfe auf einer Wolke sitzen. Ruhige Bilder für gemütliches Ausmalen vor Weihnachten.",
      "Des petits anges de Noël avec ailes et auréole, qui jouent de la trompette parmi les étoiles, tiennent une bougie ou s'assoient sur un nuage avec une harpe. Des dessins tout doux pour colorier au calme avant Noël.",
      "Angelitos de Navidad con alas y aureola que tocan la trompeta entre las estrellas, sostienen una vela o se sientan en una nube con un arpa. Dibujos tranquilos para colorear con calma antes de Navidad.",
      "Anjinhos de Natal com asas e auréola, tocando trombeta entre as estrelas, segurando uma vela ou sentados numa nuvem com uma harpa. Desenhos suaves para pintar com calma antes do Natal.",
      "Маленькие ангелы с крыльями и нимбом трубят среди звёзд, держат свечи или сидят на облаке с арфой. Спокойные картинки для неторопливого раскрашивания перед праздником.",
      "Angioletti di Natale con ali e aureola che suonano la tromba tra le stelle, reggono una candela o siedono su una nuvola con l'arpa. Disegni delicati da colorare con calma prima di Natale.",
      "Kleine kerstengeltjes met vleugels en een stralenkrans, die tussen de sterren trompet spelen, een kaarsje vasthouden of met een harp op een wolk zitten. Rustige platen om op je gemak te kleuren voor Kerstmis.",
      "Małe aniołki ze skrzydłami i aureolą grają na trąbce wśród gwiazd, trzymają świeczkę albo siedzą na chmurce z harfą. Spokojne obrazki do kolorowania w przedświątecznej ciszy.",
      "Kanatlı ve haleli küçük melekler yıldızların arasında trompet çalıyor, mum tutuyor ya da bir bulutun üstünde arp çalıyor. Sakin bir boyama keyfi için yumuşak resimler.",
      "长着翅膀、头顶光环的小天使，在星星间吹小号、捧着蜡烛，或者坐在云朵上弹竖琴。安安静静涂色的温柔图画。",
      "पंखों और प्रभामंडल वाले छोटे फ़रिश्ते तारों के बीच तुरही बजाते, मोमबत्ती थामे या बादल पर वीणा लिए बैठे। क्रिसमस से पहले शांति से रंग भरने के लिए कोमल चित्र।",
    ]),
  },
  christmasstar: {
    slug: row(["christmas-star", "sterne", "etoile-de-noel", "estrella-de-navidad", "estrela-de-natal", "zvezda", "stelle-natalizie", "kerstster", "gwiazdka", "yilbasi-yildizi", "shengdanxing", "christmas-star"]),
    name: row(["Christmas Star", "Sterne", "Étoile de Noël", "Estrella de Navidad", "Estrela de Natal", "Звезда", "Stelle natalizie", "Kerstster", "Gwiazdka", "Yılbaşı Yıldızı", "圣诞星", "क्रिसमस स्टार"]),
    h1: row(["Christmas Star Coloring Pages", "Ausmalbilder Sterne für Weihnachten", "Coloriages étoile de Noël", "Dibujos de estrella de Navidad para colorear", "Desenhos de estrela de Natal para colorir", "Раскраски рождественская звезда", "Disegni di stelle natalizie da colorare", "Kerstster kleurplaten", "Kolorowanki gwiazdka", "Yılbaşı Yıldızı Boyama", "圣诞星星涂色页", "क्रिसमस स्टार रंग भरने के चित्र"]),
    intro: row([
      "Shining stars with rays, a star over a snowy village, star lanterns and paper star ornaments. Stars are simple shapes, so these pages are great for the youngest colorists.",
      "Leuchtende Sterne mit Strahlen, ein Stern über dem verschneiten Dorf, Sternlaternen und Papiersterne am Band. Sterne haben einfache Formen – ideal für die Kleinsten.",
      "Des étoiles brillantes avec leurs rayons, une étoile au-dessus d'un village enneigé, des lanternes et des étoiles en papier. Les étoiles ont des formes simples, parfaites pour les plus petits.",
      "Estrellas brillantes con rayos, una estrella sobre un pueblo nevado, farolillos y estrellas de papel. Las estrellas tienen formas sencillas: ideales para los más pequeños.",
      "Estrelas brilhantes com raios, uma estrela sobre uma vila com neve, lanternas e estrelas de papel. As estrelas têm formas simples, ótimas para os menores.",
      "Сияющие звёзды с лучами, звезда над заснеженной деревней, фонарики-звёздочки и бумажные звёзды на ленточках. Простые формы — то, что нужно самым маленьким.",
      "Stelle splendenti con i raggi, una stella sopra un villaggio innevato, lanterne a stella e stelline di carta. Forme semplici, perfette per i più piccoli.",
      "Stralende sterren, een ster boven een besneeuwd dorp, sterlantaarns en papieren sterren aan een lint. Sterren hebben eenvoudige vormen, ideaal voor de allerkleinsten.",
      "Lśniące gwiazdy z promieniami, gwiazda nad zaśnieżoną wioską, gwiezdne lampiony i papierowe gwiazdki na wstążkach. Proste kształty, idealne dla najmłodszych.",
      "Işıl ışıl parlayan yıldızlar, karlı bir köyün üstünde bir yıldız, yıldız fenerleri ve kurdeleli kâğıt yıldızlar. Basit şekiller, en küçükler için birebir.",
      "闪闪发光的星星、雪村上空的一颗星、星星灯笼和挂在丝带上的纸星星。星星形状简单，最适合小小涂色家。",
      "किरणों वाले चमकते तारे, बर्फ़ीले गाँव के ऊपर एक तारा, तारे वाली लालटेन और रिबन पर लटके कागज़ के तारे। आसान आकार, सबसे छोटे बच्चों के लिए बढ़िया।",
    ]),
  },
  gingerbread: {
    slug: row(["gingerbread", "lebkuchen", "pain-d-epices", "galletas-de-jengibre", "biscoito-de-gengibre", "pryanik", "pan-di-zenzero", "peperkoek", "piernik", "zencefilli-kurabiye", "jiangbing", "gingerbread"]),
    name: row(["Gingerbread", "Lebkuchen", "Pain d'épices", "Galletas de jengibre", "Biscoito de gengibre", "Пряник", "Pan di zenzero", "Peperkoek", "Piernik", "Zencefilli Kurabiye", "姜饼", "जिंजरब्रेड"]),
    h1: row(["Gingerbread Coloring Pages", "Ausmalbilder Lebkuchen", "Coloriages pain d'épices", "Dibujos de galletas de jengibre para colorear", "Desenhos de biscoito de gengibre para colorir", "Раскраски пряник", "Disegni di pan di zenzero da colorare", "Peperkoek kleurplaten", "Kolorowanki piernik", "Zencefilli Kurabiye Boyama", "姜饼人涂色页", "जिंजरब्रेड रंग भरने के चित्र"]),
    intro: row([
      "Gingerbread men with icing buttons, a whole gingerbread family, a house with a candy roof and cookies fresh from the oven. Color them as sweet as you like, online or printed.",
      "Lebkuchenmänner mit Zuckerguss-Knöpfen, eine ganze Lebkuchenfamilie, ein Haus mit Bonbondach und Plätzchen frisch aus dem Ofen. Mal sie so süß aus, wie du magst – online oder ausgedruckt.",
      "Des bonshommes en pain d'épices avec boutons en glaçage, toute une famille, une maison au toit de bonbons et des biscuits tout juste sortis du four. Colorie-les aussi gourmands que tu veux, en ligne ou imprimés.",
      "Hombrecitos de jengibre con botones de glaseado, toda una familia, una casita con tejado de caramelos y galletas recién horneadas. Coloréalos tan dulces como quieras, en línea o impresos.",
      "Bonequinhos de gengibre com botões de glacê, uma família inteira, uma casinha com telhado de doces e biscoitos saídos do forno. Pinte do jeito mais doce que quiser, online ou impresso.",
      "Пряничные человечки с пуговицами из глазури, целая пряничная семья, домик с крышей из конфет и печенье прямо из духовки. Раскрась их как можно аппетитнее — онлайн или на бумаге.",
      "Omini di pan di zenzero con bottoni di glassa, un'intera famiglia, una casetta con il tetto di caramelle e biscotti appena sfornati. Colorali dolci quanto vuoi, online o stampati.",
      "Peperkoekmannetjes met knoopjes van glazuur, een hele peperkoekfamilie, een huisje met een dak van snoepjes en koekjes vers uit de oven. Kleur ze zo zoet als je wilt, online of geprint.",
      "Piernikowe ludziki z guzikami z lukru, cała piernikowa rodzina, domek z dachem z cukierków i ciasteczka prosto z pieca. Pokoloruj je tak słodko, jak lubisz — online albo na wydruku.",
      "Krema düğmeli zencefilli kurabiye adamlar, koca bir kurabiye ailesi, şeker çatılı bir ev ve fırından yeni çıkmış kurabiyeler. İstediğin kadar tatlı renklerle boya, çevrimiçi ya da kâğıtta.",
      "糖霜纽扣的姜饼人、一整个姜饼家庭、糖果屋顶的小房子，还有刚出炉的饼干。想涂多甜就涂多甜，在线或打印都行。",
      "आइसिंग बटन वाले जिंजरब्रेड मैन, पूरा जिंजरब्रेड परिवार, कैंडी की छत वाला घर और ओवन से निकली ताज़ा कुकीज़। जितना मीठा चाहें उतना रंग भरें, ऑनलाइन या प्रिंट करके।",
    ]),
  },
  winteranimals: {
    slug: row(["winter-animals", "wintertiere", "animaux-d-hiver", "animales-de-invierno", "animais-de-inverno", "zimnie-zhivotnye", "animali-d-inverno", "winterdieren", "zwierzeta-zima", "kis-hayvanlari", "dongtian-dongwu", "sardi-ke-jaanwar"]),
    name: row(["Winter Animals", "Wintertiere", "Animaux d'hiver", "Animales de invierno", "Animais de inverno", "Зимние животные", "Animali d'inverno", "Winterdieren", "Zwierzęta zimą", "Kış Hayvanları", "冬季动物", "सर्दियों के जानवर"]),
    h1: row(["Winter Animals Coloring Pages", "Ausmalbilder Wintertiere", "Coloriages animaux d'hiver", "Dibujos de animales de invierno para colorear", "Desenhos de animais de inverno para colorir", "Раскраски зимние животные", "Disegni di animali d'inverno da colorare", "Winterdieren kleurplaten", "Kolorowanki zwierzęta zimą", "Kış Hayvanları Boyama", "冬季动物涂色页", "सर्दियों के जानवर रंग भरने के चित्र"]),
    intro: row([
      "Polar bear cubs, penguin families, foxes curled up in the snow, owls on frosty branches and bunnies with fluffy tails. Animals that love the cold, ready to color online or to print.",
      "Eisbärbabys, Pinguinfamilien, Füchse eingerollt im Schnee, Eulen auf frostigen Ästen und Hasen mit Puschelschwanz. Tiere, die die Kälte lieben – fertig zum Ausmalen, online oder auf Papier.",
      "Des oursons polaires, des familles de manchots, des renards blottis dans la neige, des hiboux sur des branches givrées et des lapins à la queue toute douce. Des animaux qui aiment le froid, à colorier en ligne ou à imprimer.",
      "Oseznos polares, familias de pingüinos, zorros acurrucados en la nieve, búhos en ramas heladas y conejitos de cola esponjosa. Animales a los que les encanta el frío, listos para colorear en línea o imprimir.",
      "Filhotes de urso-polar, famílias de pinguins, raposas enroladinhas na neve, corujas em galhos gelados e coelhinhos de rabo fofo. Bichos que adoram o frio, prontos para pintar online ou imprimir.",
      "Белые медвежата, семьи пингвинов, лисички, свернувшиеся в снегу, совы на заиндевелых ветках и пушистые зайчики. Звери, которые любят холод, — раскрашивай онлайн или распечатай.",
      "Cuccioli di orso polare, famiglie di pinguini, volpi acciambellate nella neve, gufi su rami ghiacciati e coniglietti dalla coda soffice. Animali che amano il freddo, pronti da colorare online o da stampare.",
      "IJsbeerwelpjes, pinguïnfamilies, vosjes opgerold in de sneeuw, uilen op berijpte takken en konijntjes met een pluizige staart. Dieren die van de kou houden, klaar om online te kleuren of te printen.",
      "Małe misie polarne, pingwinie rodziny, liski zwinięte w śniegu, sowy na oszronionych gałęziach i zajączki z puszystym ogonkiem. Zwierzęta, które kochają mróz — do kolorowania online lub do druku.",
      "Yavru kutup ayıları, penguen aileleri, karda kıvrılmış tilkiler, buzlu dallarda baykuşlar ve pofuduk kuyruklu tavşanlar. Soğuğu seven hayvanlar, çevrimiçi boyamaya ya da yazdırmaya hazır.",
      "北极熊宝宝、企鹅一家、蜷在雪地里的狐狸、结霜树枝上的猫头鹰，还有毛茸茸尾巴的小兔子。喜欢寒冷的动物们，等你在线涂色或打印。",
      "ध्रुवीय भालू के बच्चे, पेंगुइन परिवार, बर्फ़ में सिमटी लोमड़ियाँ, पाले से ढकी डालियों पर उल्लू और रोएँदार पूँछ वाले खरगोश। ठंड पसंद करने वाले जानवर, ऑनलाइन रंग भरने या प्रिंट करने के लिए तैयार।",
    ]),
  },
};

// New gallery topics (gallery.TOPIC_META). Six subjects each, drawn at every difficulty.
const NEW_META = {
  christmastree: { emoji: "🌲", name: "Christmas Tree", subjects: [
    "Christmas tree with baubles and a star on top", "little Christmas tree in a pot with presents", "Christmas tree in a snowy forest with animals",
    "children decorating a Christmas tree", "Christmas tree with garlands and candy canes", "Christmas tree next to a cozy fireplace"] },
  santa: { emoji: "🎅", name: "Santa Claus", subjects: [
    "Santa Claus waving with a big smile", "Santa Claus flying his sleigh over the rooftops", "Santa Claus climbing down the chimney",
    "Santa Claus and elves wrapping presents", "Santa Claus with a teddy bear and a present", "Santa Claus in an armchair with cookies and milk"] },
  reindeer: { emoji: "🦌", name: "Reindeer", subjects: [
    "cute baby reindeer in the snow", "reindeer with big antlers and jingle bells", "reindeer wearing a scarf and a Christmas hat",
    "two reindeer playing in a snowy forest", "reindeer leaping over snowy hills", "reindeer pulling a little sled with presents"] },
  christmasangel: { emoji: "👼", name: "Christmas Angel", subjects: [
    "little Christmas angel with wings and a halo", "angel playing a trumpet among the stars", "angel holding a candle",
    "angel sitting on a cloud with a harp", "angel ornament hanging on a Christmas tree", "two angels holding a big star"] },
  christmasstar: { emoji: "⭐", name: "Christmas Star", subjects: [
    "big shining Christmas star with rays", "Christmas star above a snowy village", "star lantern hanging in a window",
    "smiling star with a Christmas hat", "paper star ornaments hanging on ribbons", "shooting star over a Christmas tree"] },
  gingerbread: { emoji: "🍪", name: "Gingerbread", subjects: [
    "gingerbread man with icing buttons", "gingerbread house with a candy roof", "gingerbread family of three",
    "gingerbread cookies on a baking tray", "gingerbread man holding a candy cane", "gingerbread girl with a bow"] },
  winteranimals: { emoji: "🐧", name: "Winter Animals", subjects: [
    "polar bear cub on the ice", "penguin family on an iceberg", "fox curled up in the snow",
    "owl on a snowy branch", "bunny in the snow", "deer in a winter forest"] },
};
for (const m of Object.values(NEW_META)) Object.assign(m, { seasonal: true, season: "christmas" });
// Evergreen subject topics (lib/subject-topics, growth plan L2) use the same page
// machinery; merged in below so every consumer of this module sees them too.
const subjectTopics = require("./subject-topics");
Object.assign(TOPICS, subjectTopics.TOPICS);
Object.assign(NEW_META, subjectTopics.META);

// Picture labels: [English subject, de, fr, es, pt, ru, it, nl, pl, tr, zh, hi].
// de = null where gallery.DE_SUBJECT_LABELS already has it.
const LABELS = [
  // weihnachten
  ["decorated Christmas tree with presents underneath", null, "Sapin décoré avec des cadeaux", "Árbol decorado con regalos debajo", "Árvore enfeitada com presentes", "Нарядная ёлка с подарками", "Albero addobbato con i regali", "Versierde kerstboom met cadeautjes", "Ubrana choinka z prezentami", "Altında hediyeler olan süslü ağaç", "挂满装饰、下面放着礼物的圣诞树", "उपहारों के साथ सजा क्रिसमस ट्री"],
  ["Santa Claus with a sack of presents", null, "Père Noël et sa hotte de cadeaux", "Papá Noel con su saco de regalos", "Papai Noel com o saco de presentes", "Санта с мешком подарков", "Babbo Natale con il sacco dei regali", "Kerstman met een zak cadeautjes", "Mikołaj z workiem prezentów", "Hediye çuvallı Noel Baba", "背着礼物袋的圣诞老人", "उपहारों की थैली लिए सांता"],
  ["reindeer pulling a sleigh with gifts", null, "Renne tirant un traîneau de cadeaux", "Reno tirando de un trineo con regalos", "Rena puxando um trenó de presentes", "Олень везёт сани с подарками", "Renna che traina una slitta di regali", "Rendier trekt een slee met cadeaus", "Renifer ciągnie sanie z prezentami", "Hediyeli kızak çeken ren geyiği", "拉着礼物雪橇的驯鹿", "उपहारों की स्लेज खींचता रेनडियर"],
  ["Christmas angel with wings holding a star", null, "Ange de Noël tenant une étoile", "Ángel de Navidad con una estrella", "Anjo de Natal segurando uma estrela", "Ангел со звездой", "Angelo di Natale con una stella", "Kerstengel met een ster", "Aniołek z gwiazdą", "Yıldız tutan melek", "捧着星星的圣诞天使", "तारा थामे फ़रिश्ता"],
  ["gingerbread house with candy decorations", null, "Maison en pain d'épices", "Casita de jengibre con caramelos", "Casinha de gengibre com doces", "Пряничный домик", "Casetta di pan di zenzero", "Peperkoekhuisje met snoepjes", "Piernikowy domek", "Şekerli zencefilli kurabiye evi", "糖果装饰的姜饼屋", "कैंडी से सजा जिंजरब्रेड घर"],
  ["Christmas stocking hanging on a fireplace", null, "Chaussette de Noël à la cheminée", "Calcetín navideño en la chimenea", "Meia de Natal na lareira", "Рождественский носок у камина", "Calza appesa al camino", "Kerstsok aan de schouw", "Skarpeta świąteczna przy kominku", "Şömineye asılı yılbaşı çorabı", "挂在壁炉上的圣诞袜", "अंगीठी पर टंगा क्रिसमस मोज़ा"],
  ["nativity scene in a stable under a star", null, "Crèche dans l'étable sous l'étoile", "Belén en el establo bajo la estrella", "Presépio no estábulo sob a estrela", "Вертеп в хлеву под звездой", "Presepe nella stalla sotto la stella", "Kerststal onder de ster", "Szopka pod gwiazdą", "Yıldızın altında ahırda doğum sahnesi", "星光下马厩里的耶稣诞生场景", "तारे के नीचे अस्तबल में जन्म का दृश्य"],
  ["Christmas bells with a ribbon bow", null, "Cloches de Noël avec un nœud", "Campanas de Navidad con lazo", "Sinos de Natal com laço", "Рождественские колокольчики с бантом", "Campane di Natale con il fiocco", "Kerstklokken met een strik", "Dzwonki świąteczne z kokardą", "Kurdeleli yılbaşı çanları", "系着蝴蝶结的圣诞铃铛", "रिबन वाली क्रिसमस घंटियाँ"],
  ["teddy bear unwrapping a Christmas present", null, "Nounours ouvrant un cadeau", "Osito abriendo un regalo", "Ursinho abrindo um presente", "Мишка открывает подарок", "Orsetto che scarta un regalo", "Teddybeer pakt een cadeautje uit", "Miś rozpakowuje prezent", "Hediye açan oyuncak ayı", "拆圣诞礼物的泰迪熊", "उपहार खोलता टेडी बियर"],
  // schneemann
  ["happy snowman with scarf and top hat", null, "Bonhomme de neige avec écharpe et chapeau", "Muñeco de nieve con bufanda y sombrero", "Boneco de neve com cachecol e cartola", "Снеговик в шарфе и цилиндре", "Pupazzo di neve con sciarpa e cilindro", "Sneeuwpop met sjaal en hoge hoed", "Bałwan w szaliku i cylindrze", "Atkılı ve şapkalı kardan adam", "戴围巾和礼帽的快乐雪人", "मफ़लर और टोपी वाला स्नोमैन"],
  ["snowman with carrot nose and a broom", null, "Bonhomme de neige avec un balai", "Muñeco de nieve con escoba", "Boneco de neve com vassoura", "Снеговик с метлой", "Pupazzo di neve con la scopa", "Sneeuwpop met een bezem", "Bałwan z miotłą", "Süpürgeli kardan adam", "胡萝卜鼻子拿扫帚的雪人", "गाजर की नाक और झाड़ू वाला स्नोमैन"],
  ["children building a snowman", null, "Enfants qui font un bonhomme de neige", "Niños haciendo un muñeco de nieve", "Crianças fazendo um boneco de neve", "Дети лепят снеговика", "Bambini che fanno un pupazzo di neve", "Kinderen maken een sneeuwpop", "Dzieci lepią bałwana", "Kardan adam yapan çocuklar", "堆雪人的孩子们", "स्नोमैन बनाते बच्चे"],
  ["snowman family of three in the snow", null, "Famille bonhomme de neige", "Familia de muñecos de nieve", "Família de bonecos de neve", "Семья снеговиков", "Famiglia di pupazzi di neve", "Sneeuwpoppenfamilie", "Rodzina bałwanków", "Kardan adam ailesi", "雪人一家三口", "स्नोमैन परिवार"],
  ["snowman with little birds on his arms", null, "Bonhomme de neige et petits oiseaux", "Muñeco de nieve con pajaritos", "Boneco de neve com passarinhos", "Снеговик с птичками", "Pupazzo di neve con uccellini", "Sneeuwpop met vogeltjes", "Bałwan z ptaszkami", "Kollarında kuşlar olan kardan adam", "手臂上停着小鸟的雪人", "बाँहों पर चिड़ियों वाला स्नोमैन"],
  ["snowman in a snowy village with houses", null, "Bonhomme de neige dans le village", "Muñeco de nieve en un pueblo nevado", "Boneco de neve numa vila com neve", "Снеговик в заснеженной деревне", "Pupazzo di neve nel villaggio innevato", "Sneeuwpop in een besneeuwd dorp", "Bałwan w zaśnieżonej wiosce", "Karlı köyde kardan adam", "雪村里的雪人", "बर्फ़ीले गाँव में स्नोमैन"],
  ["snowman ice skating on a frozen pond", null, "Bonhomme de neige qui patine", "Muñeco de nieve patinando", "Boneco de neve patinando", "Снеговик на коньках", "Pupazzo di neve sui pattini", "Schaatsende sneeuwpop", "Bałwan na łyżwach", "Paten kayan kardan adam", "在冰湖上滑冰的雪人", "जमी झील पर स्केटिंग करता स्नोमैन"],
  // adventskalender
  ["advent wreath with four candles and pine branches", null, "Couronne de l'Avent avec bougies", "Corona de Adviento con velas", "Coroa do Advento com velas", "Рождественский венок со свечами", "Corona dell'Avvento con candele", "Adventskrans met kaarsen", "Wieniec adwentowy ze świecami", "Mumlu advent çelengi", "插着蜡烛的降临节花环", "मोमबत्तियों वाली एडवेंट माला"],
  ["burning candle with holly leaves", null, "Bougie et feuilles de houx", "Vela con hojas de acebo", "Vela com folhas de azevinho", "Свеча с остролистом", "Candela con foglie di agrifoglio", "Kaars met hulstblaadjes", "Świeca z liśćmi ostrokrzewu", "Çobanpüskülü yapraklı mum", "点燃的蜡烛和冬青叶", "होली पत्तियों के साथ जलती मोमबत्ती"],
  ["Christmas cookies in star and heart shapes", null, "Biscuits de Noël en étoile et en cœur", "Galletas de estrella y corazón", "Biscoitos de estrela e coração", "Печенье-звёздочки и сердечки", "Biscotti a stella e a cuore", "Kerstkoekjes in ster- en hartvorm", "Ciasteczka w kształcie gwiazdek i serc", "Yıldız ve kalp kurabiyeler", "星星和爱心形状的圣诞饼干", "तारे और दिल के आकार की कुकीज़"],
  ["Christmas star with sparkles", null, "Étoile de Noël scintillante", "Estrella de Navidad brillante", "Estrela de Natal brilhante", "Сверкающая звезда", "Stella di Natale scintillante", "Fonkelende kerstster", "Błyszcząca gwiazda", "Parıltılı yılbaşı yıldızı", "闪闪发光的圣诞星", "चमकता क्रिसमस तारा"],
  ["gingerbread man", null, "Bonhomme en pain d'épices", "Hombrecito de jengibre", "Bonequinho de gengibre", "Пряничный человечек", "Omino di pan di zenzero", "Peperkoekmannetje", "Piernikowy ludzik", "Zencefilli kurabiye adam", "姜饼人", "जिंजरब्रेड मैन"],
  ["Christmas tree bauble with stars", null, "Boule de Noël à étoiles", "Bola de Navidad con estrellas", "Bola de Natal com estrelas", "Ёлочный шар со звёздами", "Pallina di Natale con stelle", "Kerstbal met sterren", "Bombka w gwiazdki", "Yıldızlı ağaç süsü", "带星星图案的圣诞彩球", "तारों वाली क्रिसमस बॉल"],
  ["wrapped present with a big bow", null, "Cadeau avec un gros nœud", "Regalo con un gran lazo", "Presente com um laço grande", "Подарок с большим бантом", "Regalo con un grande fiocco", "Cadeau met een grote strik", "Prezent z dużą kokardą", "Kocaman fiyonklu hediye", "系着大蝴蝶结的礼物", "बड़े रिबन वाला उपहार"],
  ["cute penguin with a Christmas hat", null, "Pingouin avec un bonnet de Noël", "Pingüino con gorro navideño", "Pinguim com gorro de Natal", "Пингвин в новогодней шапке", "Pinguino con il cappello di Natale", "Pinguïn met een kerstmuts", "Pingwin w świątecznej czapce", "Noel şapkalı penguen", "戴圣诞帽的可爱企鹅", "क्रिसमस टोपी वाला पेंगुइन"],
  ["squirrel with a lantern in the snow", null, "Écureuil avec une lanterne", "Ardilla con un farolillo", "Esquilo com uma lanterna", "Белка с фонариком в снегу", "Scoiattolo con la lanterna", "Eekhoorn met een lantaarn", "Wiewiórka z lampionem", "Karda fenerli sincap", "雪中提灯笼的松鼠", "बर्फ़ में लालटेन लिए गिलहरी"],
  ["little wooden sled loaded with wrapped presents in the snow", "Holzschlitten mit Geschenken im Schnee", "Luge chargée de cadeaux", "Trineo de madera con regalos", "Trenó de madeira com presentes", "Санки с подарками", "Slittino carico di regali", "Houten slee met cadeautjes", "Sanki z prezentami", "Hediye yüklü tahta kızak", "装满礼物的小木雪橇", "उपहारों से लदी लकड़ी की स्लेज"],
  // christmastree
  ["Christmas tree with baubles and a star on top", "Weihnachtsbaum mit Kugeln und Stern", "Sapin avec boules et étoile", "Árbol con bolas y estrella", "Árvore com bolas e estrela", "Ёлка с шарами и звездой", "Albero con palline e stella", "Kerstboom met ballen en ster", "Choinka z bombkami i gwiazdą", "Süslü ve yıldızlı yılbaşı ağacı", "挂彩球、顶着星星的圣诞树", "गेंदों और तारे वाला क्रिसमस ट्री"],
  ["little Christmas tree in a pot with presents", "Kleiner Weihnachtsbaum im Topf", "Petit sapin en pot avec cadeaux", "Arbolito en maceta con regalos", "Arvorezinha no vaso com presentes", "Маленькая ёлочка в горшке", "Alberello in vaso con regali", "Klein kerstboompje in een pot", "Mała choinka w doniczce", "Saksıda küçük yılbaşı ağacı", "花盆里的小圣诞树和礼物", "गमले में छोटा क्रिसमस ट्री"],
  ["Christmas tree in a snowy forest with animals", "Weihnachtsbaum im Winterwald mit Tieren", "Sapin dans la forêt avec les animaux", "Árbol en el bosque nevado con animales", "Árvore na floresta com animais", "Ёлка в зимнем лесу со зверятами", "Albero nel bosco innevato con animali", "Kerstboom in het bos met dieren", "Choinka w lesie ze zwierzętami", "Karlı ormanda hayvanlarla ağaç", "雪林里的圣诞树和小动物", "जानवरों के साथ बर्फ़ीले जंगल में पेड़"],
  ["children decorating a Christmas tree", "Kinder schmücken den Weihnachtsbaum", "Enfants qui décorent le sapin", "Niños decorando el árbol", "Crianças enfeitando a árvore", "Дети наряжают ёлку", "Bambini che addobbano l'albero", "Kinderen versieren de kerstboom", "Dzieci ubierają choinkę", "Ağacı süsleyen çocuklar", "孩子们装饰圣诞树", "क्रिसमस ट्री सजाते बच्चे"],
  ["Christmas tree with garlands and candy canes", "Weihnachtsbaum mit Girlanden und Zuckerstangen", "Sapin avec guirlandes et sucres d'orge", "Árbol con guirnaldas y bastones de caramelo", "Árvore com guirlandas e bengalinhas", "Ёлка с гирляндами и леденцами", "Albero con ghirlande e bastoncini di zucchero", "Kerstboom met slingers en zuurstokken", "Choinka z łańcuchami i laskami cukrowymi", "Girlandlı ve şeker bastonlu ağaç", "挂着彩带和拐杖糖的圣诞树", "मालाओं और कैंडी केन वाला पेड़"],
  ["Christmas tree next to a cozy fireplace", "Weihnachtsbaum am Kamin", "Sapin près de la cheminée", "Árbol junto a la chimenea", "Árvore ao lado da lareira", "Ёлка у камина", "Albero accanto al camino", "Kerstboom bij de open haard", "Choinka przy kominku", "Şöminenin yanında ağaç", "温暖壁炉旁的圣诞树", "अंगीठी के पास क्रिसमस ट्री"],
  // santa
  ["Santa Claus waving with a big smile", "Weihnachtsmann winkt fröhlich", "Père Noël qui salue en souriant", "Papá Noel saludando sonriente", "Papai Noel acenando sorridente", "Улыбающийся Санта машет рукой", "Babbo Natale che saluta sorridendo", "Zwaaiende Kerstman", "Uśmiechnięty Mikołaj macha", "Gülümseyerek el sallayan Noel Baba", "笑着挥手的圣诞老人", "मुस्कुराते हुए हाथ हिलाते सांता"],
  ["Santa Claus flying his sleigh over the rooftops", "Weihnachtsmann fliegt mit dem Schlitten über die Dächer", "Père Noël en traîneau au-dessus des toits", "Papá Noel en trineo sobre los tejados", "Papai Noel de trenó sobre os telhados", "Санта в санях над крышами", "Babbo Natale in slitta sopra i tetti", "Kerstman met de slee boven de daken", "Mikołaj w saniach nad dachami", "Kızağıyla çatıların üstünden uçan Noel Baba", "驾雪橇飞过屋顶的圣诞老人", "छतों के ऊपर स्लेज उड़ाते सांता"],
  ["Santa Claus climbing down the chimney", "Weihnachtsmann im Kamin", "Père Noël dans la cheminée", "Papá Noel bajando por la chimenea", "Papai Noel descendo pela chaminé", "Санта спускается по трубе", "Babbo Natale che scende dal camino", "Kerstman in de schoorsteen", "Mikołaj schodzi przez komin", "Bacadan inen Noel Baba", "从烟囱爬下来的圣诞老人", "चिमनी से उतरते सांता"],
  ["Santa Claus and elves wrapping presents", "Weihnachtsmann und Elfen packen Geschenke ein", "Père Noël et les lutins emballent les cadeaux", "Papá Noel y los duendes envolviendo regalos", "Papai Noel e duendes embrulhando presentes", "Санта и эльфы упаковывают подарки", "Babbo Natale e gli elfi incartano i regali", "Kerstman en elfjes pakken cadeaus in", "Mikołaj i elfy pakują prezenty", "Cücelerle hediye paketleyen Noel Baba", "圣诞老人和小精灵包礼物", "एल्फ़ के साथ उपहार लपेटते सांता"],
  ["Santa Claus with a teddy bear and a present", "Weihnachtsmann mit Teddy und Geschenk", "Père Noël avec un nounours et un cadeau", "Papá Noel con un osito y un regalo", "Papai Noel com ursinho e presente", "Санта с мишкой и подарком", "Babbo Natale con orsetto e regalo", "Kerstman met teddybeer en cadeau", "Mikołaj z misiem i prezentem", "Oyuncak ayı ve hediyeli Noel Baba", "抱着泰迪熊和礼物的圣诞老人", "टेडी बियर और उपहार लिए सांता"],
  ["Santa Claus in an armchair with cookies and milk", "Weihnachtsmann im Sessel mit Keksen und Milch", "Père Noël dans un fauteuil avec lait et biscuits", "Papá Noel en un sillón con galletas y leche", "Papai Noel na poltrona com biscoitos e leite", "Санта в кресле с печеньем и молоком", "Babbo Natale in poltrona con latte e biscotti", "Kerstman in een stoel met koekjes en melk", "Mikołaj w fotelu z ciastkami i mlekiem", "Koltukta kurabiye ve sütle Noel Baba", "坐在扶手椅上吃饼干喝牛奶的圣诞老人", "कुर्सी पर कुकीज़ और दूध के साथ सांता"],
  // reindeer
  ["cute baby reindeer in the snow", "Süßes Rentierbaby im Schnee", "Bébé renne dans la neige", "Reno bebé en la nieve", "Filhote de rena na neve", "Оленёнок в снегу", "Cucciolo di renna nella neve", "Rendierjong in de sneeuw", "Mały renifer w śniegu", "Karda yavru ren geyiği", "雪地里的可爱小驯鹿", "बर्फ़ में नन्हा रेनडियर"],
  ["reindeer with big antlers and jingle bells", "Rentier mit großem Geweih und Glöckchen", "Renne aux grands bois et clochettes", "Reno con grandes astas y cascabeles", "Rena com chifres grandes e sininhos", "Олень с большими рогами и бубенцами", "Renna con grandi corna e campanelli", "Rendier met groot gewei en belletjes", "Renifer z porożem i dzwoneczkami", "Büyük boynuzlu, çıngıraklı ren geyiği", "大鹿角戴铃铛的驯鹿", "बड़े सींगों और घंटियों वाला रेनडियर"],
  ["reindeer wearing a scarf and a Christmas hat", "Rentier mit Schal und Weihnachtsmütze", "Renne avec écharpe et bonnet de Noël", "Reno con bufanda y gorro navideño", "Rena com cachecol e gorro de Natal", "Олень в шарфе и новогодней шапке", "Renna con sciarpa e cappello di Natale", "Rendier met sjaal en kerstmuts", "Renifer w szaliku i czapce", "Atkılı ve Noel şapkalı ren geyiği", "戴围巾和圣诞帽的驯鹿", "मफ़लर और क्रिसमस टोपी वाला रेनडियर"],
  ["two reindeer playing in a snowy forest", "Zwei Rentiere spielen im Winterwald", "Deux rennes qui jouent dans la forêt", "Dos renos jugando en el bosque", "Duas renas brincando na floresta", "Два оленя играют в зимнем лесу", "Due renne che giocano nel bosco", "Twee rendieren spelen in het bos", "Dwa renifery bawią się w lesie", "Karlı ormanda oynayan iki ren geyiği", "雪林里玩耍的两只驯鹿", "बर्फ़ीले जंगल में खेलते दो रेनडियर"],
  ["reindeer leaping over snowy hills", "Rentier springt über verschneite Hügel", "Renne qui saute sur les collines", "Reno saltando sobre colinas nevadas", "Rena saltando sobre colinas com neve", "Олень прыгает по снежным холмам", "Renna che salta sulle colline innevate", "Rendier springt over besneeuwde heuvels", "Renifer skacze po zaśnieżonych wzgórzach", "Karlı tepelerde zıplayan ren geyiği", "跃过雪山坡的驯鹿", "बर्फ़ीली पहाड़ियों पर छलांग लगाता रेनडियर"],
  ["reindeer pulling a little sled with presents", "Rentier zieht einen kleinen Schlitten mit Geschenken", "Renne qui tire une luge de cadeaux", "Reno tirando de un trineo pequeño", "Rena puxando um trenozinho", "Олень везёт санки с подарками", "Renna che tira uno slittino di regali", "Rendier trekt een sleetje met cadeaus", "Renifer ciągnie sanki z prezentami", "Küçük hediyeli kızak çeken ren geyiği", "拉着礼物小雪橇的驯鹿", "उपहारों की छोटी स्लेज खींचता रेनडियर"],
  // christmasangel
  ["little Christmas angel with wings and a halo", "Kleiner Weihnachtsengel mit Heiligenschein", "Petit ange de Noël avec auréole", "Angelito de Navidad con aureola", "Anjinho de Natal com auréola", "Маленький ангел с нимбом", "Angioletto di Natale con aureola", "Klein kerstengeltje met stralenkrans", "Mały aniołek z aureolą", "Haleli küçük melek", "长着翅膀和光环的小天使", "पंखों और प्रभामंडल वाला नन्हा फ़रिश्ता"],
  ["angel playing a trumpet among the stars", "Engel spielt Trompete zwischen den Sternen", "Ange qui joue de la trompette", "Ángel tocando la trompeta entre estrellas", "Anjo tocando trombeta entre estrelas", "Ангел трубит среди звёзд", "Angelo che suona la tromba tra le stelle", "Engel speelt trompet tussen de sterren", "Aniołek gra na trąbce wśród gwiazd", "Yıldızlar arasında trompet çalan melek", "在星星间吹小号的天使", "तारों के बीच तुरही बजाता फ़रिश्ता"],
  ["angel holding a candle", "Engel mit Kerze", "Ange avec une bougie", "Ángel con una vela", "Anjo com uma vela", "Ангел со свечой", "Angelo con una candela", "Engel met een kaars", "Aniołek ze świeczką", "Mum tutan melek", "捧着蜡烛的天使", "मोमबत्ती थामे फ़रिश्ता"],
  ["angel sitting on a cloud with a harp", "Engel mit Harfe auf einer Wolke", "Ange sur un nuage avec une harpe", "Ángel en una nube con un arpa", "Anjo numa nuvem com harpa", "Ангел с арфой на облаке", "Angelo con l'arpa su una nuvola", "Engel met harp op een wolk", "Aniołek z harfą na chmurce", "Bulutta arp çalan melek", "坐在云上弹竖琴的天使", "बादल पर वीणा लिए फ़रिश्ता"],
  ["angel ornament hanging on a Christmas tree", "Engel als Baumschmuck", "Ange suspendu au sapin", "Adorno de ángel en el árbol", "Enfeite de anjo na árvore", "Ангел-игрушка на ёлке", "Angioletto appeso all'albero", "Engeltje in de kerstboom", "Aniołek na choince", "Ağaçta asılı melek süsü", "挂在圣诞树上的天使挂饰", "क्रिसमस ट्री पर टंगा फ़रिश्ता"],
  ["two angels holding a big star", "Zwei Engel mit einem großen Stern", "Deux anges avec une grande étoile", "Dos ángeles con una gran estrella", "Dois anjos com uma estrela grande", "Два ангела с большой звездой", "Due angeli con una grande stella", "Twee engelen met een grote ster", "Dwa aniołki z dużą gwiazdą", "Büyük yıldız tutan iki melek", "捧着大星星的两个天使", "बड़ा तारा थामे दो फ़रिश्ते"],
  // christmasstar
  ["big shining Christmas star with rays", "Großer leuchtender Stern", "Grande étoile brillante", "Gran estrella brillante", "Estrela grande e brilhante", "Большая сияющая звезда", "Grande stella splendente", "Grote stralende ster", "Duża lśniąca gwiazda", "Işınları olan büyük parlak yıldız", "光芒四射的大星星", "किरणों वाला बड़ा चमकता तारा"],
  ["Christmas star above a snowy village", "Stern über dem verschneiten Dorf", "Étoile au-dessus du village enneigé", "Estrella sobre un pueblo nevado", "Estrela sobre a vila com neve", "Звезда над заснеженной деревней", "Stella sopra il villaggio innevato", "Ster boven een besneeuwd dorp", "Gwiazda nad zaśnieżoną wioską", "Karlı köyün üstünde yıldız", "雪村上空的星星", "बर्फ़ीले गाँव के ऊपर तारा"],
  ["star lantern hanging in a window", "Sternlaterne im Fenster", "Lanterne étoile à la fenêtre", "Farolillo de estrella en la ventana", "Lanterna de estrela na janela", "Фонарик-звезда в окне", "Lanterna a stella alla finestra", "Sterlantaarn voor het raam", "Gwiezdny lampion w oknie", "Pencerede yıldız fener", "挂在窗前的星星灯笼", "खिड़की में टंगी तारे वाली लालटेन"],
  ["smiling star with a Christmas hat", "Lachender Stern mit Weihnachtsmütze", "Étoile souriante avec un bonnet", "Estrella sonriente con gorro", "Estrela sorridente com gorro", "Улыбающаяся звёздочка в колпаке", "Stella sorridente con il cappello", "Lachende ster met kerstmuts", "Uśmiechnięta gwiazdka w czapce", "Noel şapkalı gülümseyen yıldız", "戴圣诞帽的笑脸星星", "क्रिसमस टोपी वाला मुस्कुराता तारा"],
  ["paper star ornaments hanging on ribbons", "Papiersterne am Band", "Étoiles en papier sur des rubans", "Estrellas de papel colgadas", "Estrelas de papel penduradas", "Бумажные звёзды на ленточках", "Stelle di carta appese ai nastri", "Papieren sterren aan linten", "Papierowe gwiazdki na wstążkach", "Kurdeleye asılı kâğıt yıldızlar", "挂在丝带上的纸星星", "रिबन पर लटके कागज़ के तारे"],
  ["shooting star over a Christmas tree", "Sternschnuppe über dem Weihnachtsbaum", "Étoile filante au-dessus du sapin", "Estrella fugaz sobre el árbol", "Estrela cadente sobre a árvore", "Падающая звезда над ёлкой", "Stella cadente sopra l'albero", "Vallende ster boven de kerstboom", "Spadająca gwiazda nad choinką", "Ağacın üstünde kayan yıldız", "圣诞树上空的流星", "क्रिसमस ट्री के ऊपर टूटता तारा"],
  // gingerbread
  ["gingerbread man with icing buttons", "Lebkuchenmann mit Zuckerguss-Knöpfen", "Bonhomme en pain d'épices à boutons", "Hombrecito de jengibre con botones", "Bonequinho de gengibre com botões", "Пряничный человечек с пуговицами", "Omino di pan di zenzero con bottoni", "Peperkoekmannetje met knoopjes", "Piernikowy ludzik z guzikami", "Krema düğmeli kurabiye adam", "糖霜纽扣的姜饼人", "आइसिंग बटन वाला जिंजरब्रेड मैन"],
  ["gingerbread house with a candy roof", "Lebkuchenhaus mit Bonbondach", "Maison en pain d'épices au toit de bonbons", "Casita de jengibre con tejado de caramelos", "Casinha de gengibre com telhado de doces", "Пряничный домик с конфетной крышей", "Casetta di pan di zenzero con tetto di caramelle", "Peperkoekhuisje met snoepdak", "Piernikowy domek z dachem z cukierków", "Şeker çatılı kurabiye ev", "糖果屋顶的姜饼屋", "कैंडी की छत वाला जिंजरब्रेड घर"],
  ["gingerbread family of three", "Lebkuchenfamilie", "Famille en pain d'épices", "Familia de jengibre", "Família de gengibre", "Пряничная семья", "Famiglia di pan di zenzero", "Peperkoekfamilie", "Piernikowa rodzina", "Kurabiye ailesi", "姜饼一家三口", "जिंजरब्रेड परिवार"],
  ["gingerbread cookies on a baking tray", "Lebkuchen auf dem Backblech", "Biscuits sur la plaque du four", "Galletas de jengibre en la bandeja", "Biscoitos de gengibre na assadeira", "Пряники на противне", "Biscotti di pan di zenzero sulla teglia", "Koekjes op de bakplaat", "Pierniczki na blasze", "Fırın tepsisinde kurabiyeler", "烤盘上的姜饼", "बेकिंग ट्रे पर जिंजरब्रेड कुकीज़"],
  ["gingerbread man holding a candy cane", "Lebkuchenmann mit Zuckerstange", "Bonhomme en pain d'épices et sucre d'orge", "Hombrecito de jengibre con bastón de caramelo", "Bonequinho de gengibre com bengalinha", "Пряничный человечек с леденцом", "Omino di pan di zenzero con bastoncino", "Peperkoekmannetje met zuurstok", "Piernikowy ludzik z laską cukrową", "Şeker bastonlu kurabiye adam", "拿着拐杖糖的姜饼人", "कैंडी केन थामे जिंजरब्रेड मैन"],
  ["gingerbread girl with a bow", "Lebkuchenmädchen mit Schleife", "Petite fille en pain d'épices avec un nœud", "Niña de jengibre con lazo", "Menina de gengibre com laço", "Пряничная девочка с бантиком", "Bambina di pan di zenzero con il fiocco", "Peperkoekmeisje met strik", "Piernikowa dziewczynka z kokardą", "Fiyonklu kurabiye kız", "戴蝴蝶结的姜饼女孩", "रिबन वाली जिंजरब्रेड गर्ल"],
  // winteranimals
  ["polar bear cub on the ice", "Eisbärbaby auf dem Eis", "Ourson polaire sur la glace", "Osezno polar sobre el hielo", "Filhote de urso-polar no gelo", "Белый медвежонок на льду", "Cucciolo di orso polare sul ghiaccio", "IJsbeerwelpje op het ijs", "Mały miś polarny na lodzie", "Buzda yavru kutup ayısı", "冰面上的北极熊宝宝", "बर्फ़ पर ध्रुवीय भालू का बच्चा"],
  ["penguin family on an iceberg", "Pinguinfamilie auf dem Eisberg", "Famille de manchots sur un iceberg", "Familia de pingüinos en un iceberg", "Família de pinguins num iceberg", "Семья пингвинов на льдине", "Famiglia di pinguini su un iceberg", "Pinguïnfamilie op een ijsberg", "Pingwinia rodzina na górze lodowej", "Buzdağında penguen ailesi", "冰山上的企鹅一家", "हिमखंड पर पेंगुइन परिवार"],
  ["fox curled up in the snow", "Fuchs eingerollt im Schnee", "Renard blotti dans la neige", "Zorro acurrucado en la nieve", "Raposa enroladinha na neve", "Лисичка свернулась в снегу", "Volpe acciambellata nella neve", "Vos opgerold in de sneeuw", "Lis zwinięty w śniegu", "Karda kıvrılmış tilki", "蜷在雪地里的狐狸", "बर्फ़ में सिमटी लोमड़ी"],
  ["owl on a snowy branch", "Eule auf einem verschneiten Ast", "Hibou sur une branche enneigée", "Búho en una rama nevada", "Coruja num galho com neve", "Сова на заснеженной ветке", "Gufo su un ramo innevato", "Uil op een besneeuwde tak", "Sowa na zaśnieżonej gałęzi", "Karlı dalda baykuş", "雪枝上的猫头鹰", "बर्फ़ीली डाल पर उल्लू"],
  ["bunny in the snow", "Hase im Schnee", "Lapin dans la neige", "Conejito en la nieve", "Coelhinho na neve", "Зайчик в снегу", "Coniglietto nella neve", "Konijntje in de sneeuw", "Zajączek w śniegu", "Karda tavşan", "雪地里的小兔子", "बर्फ़ में खरगोश"],
  ["deer in a winter forest", "Reh im Winterwald", "Chevreuil dans la forêt d'hiver", "Ciervo en el bosque invernal", "Cervo na floresta de inverno", "Олень в зимнем лесу", "Cervo nel bosco d'inverno", "Hert in het winterbos", "Sarenka w zimowym lesie", "Kış ormanında geyik", "冬日森林里的鹿", "सर्दियों के जंगल में हिरण"],
];

const LABEL_LANGS = L.slice(1); // de … hi
const SUBJECT_LABELS = {};
for (const r of LABELS) {
  if (r.length !== L.length) throw new Error(`seasonal-topics: label row for "${r[0]}" has ${r.length} columns`);
  LABEL_LANGS.forEach((lang, i) => { if (r[i + 1]) (SUBJECT_LABELS[lang] ||= {})[r[0]] = r[i + 1]; });
}
for (const [lang, labels] of Object.entries(subjectTopics.SUBJECT_LABELS)) Object.assign(SUBJECT_LABELS[lang] ||= {}, labels);

// Page furniture shared by all seasonal topic pages.
const UI = {
  free: row(["Free Printables", "Kostenlos", "Gratuits", "Gratis", "Grátis", "Бесплатно", "Gratis", "Gratis", "Za darmo", "Ücretsiz", "免费", "मुफ़्त"]),
  pick: row(["Pick a picture to color", "Such dir ein Bild aus", "Choisis un dessin à colorier", "Elige un dibujo para colorear", "Escolha um desenho para colorir", "Выбери картинку для раскрашивания", "Scegli un disegno da colorare", "Kies een kleurplaat", "Wybierz obrazek do kolorowania", "Boyamak için bir resim seç", "选一张图开始涂色", "रंग भरने के लिए एक चित्र चुनें"]),
  cta: row(["Draw your own →", "Eigenes Bild malen lassen →", "Créer mon propre dessin →", "Crear mi propio dibujo →", "Criar meu próprio desenho →", "Создать свою раскраску →", "Crea il tuo disegno →", "Maak je eigen kleurplaat →", "Stwórz własną kolorowankę →", "Kendi boyamanı oluştur →", "生成我自己的涂色页 →", "अपना चित्र बनाएं →"]),
  // Title tail (growth plan L1b: lead with the searched term, then "free printable / colour online").
  tail: row(["Free Printable or Color Online", "kostenlos drucken oder online malen", "gratuits à imprimer ou en ligne", "imprimir gratis o colorear online", "imprimir grátis ou pintar online", "распечатать бесплатно или онлайн", "gratis da stampare o online", "gratis printen of online kleuren", "darmowe do druku i online", "Ücretsiz Yazdır veya Online Boya", "免费打印或在线涂色", "मुफ़्त प्रिंट करें या ऑनलाइन रंग भरें"]),
  heading: row(["🎄 Christmas & Winter", "🎄 Advent & Weihnachten", "🎄 Noël et hiver", "🎄 Navidad e invierno", "🎄 Natal e inverno", "🎄 Новый год и зима", "🎄 Natale e inverno", "🎄 Kerst en winter", "🎄 Boże Narodzenie i zima", "🎄 Yılbaşı ve kış", "🎄 圣诞与冬天", "🎄 क्रिसमस और सर्दियाँ"]),
  desc: {
    en: (h) => `${h}: free to print or to color online, for kids of all ages. No sign-up needed.`,
    de: (h) => `${h}: kostenlos ausdrucken oder online ausmalen – für Kinder jeden Alters, ohne Anmeldung.`,
    fr: (h) => `${h} : gratuits à imprimer ou à colorier en ligne, pour les enfants de tout âge. Sans inscription.`,
    es: (h) => `${h}: gratis para imprimir o colorear en línea, para niños de todas las edades. Sin registro.`,
    pt: (h) => `${h}: grátis para imprimir ou colorir online, para crianças de todas as idades. Sem cadastro.`,
    ru: (h) => `${h}: бесплатно распечатать или раскрасить онлайн, для детей любого возраста. Без регистрации.`,
    it: (h) => `${h}: gratis da stampare o colorare online, per bambini di tutte le età. Senza registrazione.`,
    nl: (h) => `${h}: gratis printen of online kleuren, voor kinderen van alle leeftijden. Zonder account.`,
    pl: (h) => `${h}: za darmo do druku lub kolorowania online, dla dzieci w każdym wieku. Bez rejestracji.`,
    tr: (h) => `${h}: ücretsiz yazdır ya da çevrimiçi boya, her yaştan çocuk için. Kayıt gerekmez.`,
    zh: (h) => `${h}：免费打印或在线涂色，适合各年龄段的孩子，无需注册。`,
    hi: (h) => `${h}: मुफ़्त में प्रिंट करें या ऑनलाइन रंग भरें, हर उम्र के बच्चों के लिए। साइन-अप की ज़रूरत नहीं।`,
  },
};

// Page strings for one topic in one language (merged over the language's templates).
function overrides(lang, id) {
  const s = TOPICS[id];
  const h1 = s.h1[lang] || s.name[lang];
  return {
    topicPageTitle: () => {
      // Long headings keep the short "free" tail so the title stays within ~62 characters.
      const long = `${h1} — ${UI.tail[lang]}`;
      const t = long.length <= 62 ? long : `${h1} — ${UI.free[lang]}`;
      return t.length + 11 <= 62 ? `${t} | Lalabuba` : t;
    },
    topicPageDesc: () => UI.desc[lang](h1),
    topicPageH1: () => h1,
    topicPageSub: () => s.intro[lang] || UI.desc[lang](h1),
    readyMadeTitle: () => UI.pick[lang],
    imageMoreLabel: () => h1,
    generateCta: () => UI.cta[lang],
  };
}

module.exports = { LANGS: L, TOPICS, NEW_META, SUBJECT_LABELS, UI, overrides };
