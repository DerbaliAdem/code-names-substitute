/**
 * Card words. Everyday English nouns, grouped by theme only to make the list easy to maintain.
 * The first group comes from frontend/prototype.html.
 */
const SOURCE = `
AGENT BANK CASTLE DRAGON EMBASSY FALCON GHOST HOTEL ICE JET KEY LASER MOLE NIGHT OPERA PIANO QUEEN ROBOT SPY
TOKYO VENOM WALL YARD ZERO BOND CODE DIAMOND ENGINE FIELD GLASS HAMMER ISLAND JUNGLE KNIFE LIGHT MOON NEEDLE
OCEAN PARK ROCKET SHADOW TRAIN UNIFORM VAULT WAVE BRIDGE CLOCK DOCTOR EAGLE FIRE GOLD HELMET INK JAM LOCK MAP
NET ORBIT PASSPORT RADIO SNOW TOWER

ALIBI BANDIT BOUNTY BRIBE CAPE CIPHER CLUB CRIME CULT DECOY DISGUISE DETECTIVE ESCAPE EVIDENCE FUGITIVE GANG
GETAWAY HEIST HERO HOSTAGE INFORMER JAIL JUDGE JURY LAWYER MASK MOTIVE MYSTERY OUTLAW PATROL PIRATE POISON
PRISON RANSOM RIVAL SABOTAGE SCANDAL SECRET SHERIFF SMUGGLER SUSPECT THIEF TRAP TRIAL VICTIM VILLAIN WITNESS

ACORN ANT BADGER BAT BEAR BEAVER BEE BEETLE BISON BUTTERFLY CAMEL CANARY CAT CHEETAH COBRA COW CRAB CROW DEER
DOLPHIN DONKEY DUCK ELEPHANT FERRET FLAMINGO FOX FROG GIRAFFE GOAT GOOSE GORILLA HAMSTER HAWK HEDGEHOG HORSE
JELLYFISH KANGAROO KOALA LEOPARD LION LIZARD LOBSTER MOOSE MOSQUITO MOTH MOUSE OCTOPUS OSTRICH OTTER OWL PANDA
PANTHER PARROT PENGUIN PIG PIGEON RABBIT RACCOON RAVEN RHINO SALMON SCORPION SEAL SHARK SHEEP SNAIL SPIDER
SQUIRREL SWAN TIGER TORTOISE TURKEY WALRUS WASP WHALE WOLF

APPLE BACON BAGEL BANANA BARREL BASIL BEAN BISCUIT BREAD BURGER BUTTER CABBAGE CANDY CARROT CHEESE CHERRY
CHILI CHOCOLATE COCONUT COFFEE CREAM CUSTARD GARLIC GINGER GRAPE HONEY KETCHUP LEMON LETTUCE LIME MANGO MELON
MINT MUFFIN MUSHROOM MUSTARD NOODLE NUT OLIVE ONION ORANGE PANCAKE PASTA PEACH PEPPER PICKLE PIE PIZZA PLUM
POPCORN POTATO PUMPKIN RICE SALT SANDWICH SAUCE SODA SOUP SPICE SUGAR SYRUP TOAST TOMATO VANILLA VINEGAR WAFFLE

ANCHOR APRON ARROW AXE BALLOON BASKET BATTERY BELL BELT BLANKET BLENDER BOOK BOOT BOTTLE BOWL BROOM BRUSH
BUCKET BUTTON CAMERA CANDLE CANNON CARD CARPET CHAIN CHAIR CHALK COIN COMB COMPASS COUCH CRADLE CRAYON CROWN
CUP CURTAIN DESK DICE DOLL DOOR DRILL DRUM ENVELOPE FAN FLAG FLUTE FORK FRAME GLOVE GUITAR HARP HOOK IRON JAR
KETTLE KITE LADDER LAMP LANTERN LETTER MAGNET MARBLE MATCH MEDAL MIRROR NAIL NECKLACE NOTEBOOK PAINT PENCIL
PILLOW PIPE PLATE PUPPET PUZZLE RAZOR RIBBON RING ROPE RUG SADDLE SCALE SCISSORS SCREW SHELF SHOVEL SOAP SPONGE
SPOON SPRING STAMP SWORD TABLE TAPE TELESCOPE TENT TOOTHBRUSH TORCH TOWEL TRUMPET TUBE TYPEWRITER UMBRELLA VASE
VIOLIN WALLET WATCH WHEEL WHISTLE WINDOW ZIPPER

AIRPORT ALLEY ARENA ATTIC BAKERY BARN BEACH CABIN CANAL CANYON CASINO CAVE CELLAR CHAPEL CINEMA CIRCUS CLIFF
COAST CORNER COURT DESERT DOCK FACTORY FARM FOREST FOUNTAIN GARAGE GARDEN GLACIER HARBOR HOSPITAL KITCHEN LAGOON
LAKE LIBRARY LIGHTHOUSE MARKET MAZE MEADOW MINE MOUNTAIN MUSEUM OASIS OFFICE PALACE POND PYRAMID RANCH REEF
RIVER ROAD SAUNA SCHOOL STADIUM STATION STUDIO SUBWAY SWAMP TEMPLE THEATER TUNNEL VALLEY VILLAGE VOLCANO WELL
ZOO

ATOM BEAM BOLT BUBBLE CIRCUIT CLOUD COMET CRYSTAL DUST EARTH ECHO ECLIPSE FEATHER FLAME FOG FOSSIL GALAXY GENE
HURRICANE LAVA LEAF LIGHTNING METEOR MUD OXYGEN PEARL PLANET PLASTIC PRISM RAINBOW ROCK ROOT SAND SATELLITE SEED
SHELL SMOKE STAR STEAM STONE STORM SUN THUNDER TORNADO VIRUS WATER WIND

ACTOR ARTIST ASTRONAUT BAKER BARBER BOXER BUTCHER BUTLER CAPTAIN CHEF CLOWN COACH COWBOY DANCER DENTIST DIVER
DRIVER FARMER GARDENER GENIUS GIANT GUARD JOKER KING KNIGHT MAGICIAN MAYOR MECHANIC MONK NINJA NURSE ORPHAN
PAINTER PILOT PLUMBER POET PRIEST PRINCE PROFESSOR SAILOR SCIENTIST SINGER SOLDIER SURGEON TAILOR TEACHER TOURIST
TWIN VAMPIRE VIKING WAITER WITCH WIZARD ZOMBIE

AMBULANCE BICYCLE BOAT CANOE CARAVAN ELEVATOR FERRY HELICOPTER MOTOR PARACHUTE RAFT SCOOTER SLED SUBMARINE TAXI
TRACTOR TRUCK WAGON YACHT

BALLET BIRTHDAY CARNIVAL CHESS CONCERT DREAM GHOUL HOLIDAY JOURNEY LEGEND LUCK MARATHON MELODY MIRACLE PARADE
PARTY PICNIC POEM RACE RHYTHM RUMOR SAFARI SHADE TANGO TARGET TENNIS TREASURE VICTORY WEDDING

ANKLE BEARD BONE BRAIN CHIN ELBOW EYE FINGER HEART KNEE LIP MUSCLE NECK NOSE PALM RIB SHOULDER SKULL THROAT
THUMB TONGUE TOOTH WRIST
`;

export const WORDS: readonly string[] = SOURCE.trim().split(/\s+/);

/** Arabic board words: common single nouns, without diacritics, shown as they are. */
const SOURCE_AR = `
بحر نهر جبل صحراء غابة جزيرة شاطئ وادي كهف بركان سماء شمس قمر نجم سحاب مطر ثلج ريح عاصفة برق
رعد ضباب قوس نار ماء تراب حجر رمل طين صخر جليد موج بحيرة شلال نخلة شجرة زهرة وردة عشب ورقة
جذر غصن ثمرة بذرة حديقة حقل مزرعة قرية مدينة عاصمة شارع طريق جسر نفق ميناء مطار محطة سوق مسجد مدرسة
جامعة مكتبة مستشفى صيدلية متحف مسرح ملعب مطعم مقهى فندق بنك قصر برج سور قلعة سجن خيمة كوخ بيت غرفة
مطبخ حمام باب نافذة سقف جدار درج سلم بئر حائط رف كرسي طاولة سرير مرآة ساعة مصباح شمعة مفتاح قفل
صندوق حقيبة محفظة كيس سلة جرة إبريق فنجان كأس صحن ملعقة شوكة سكين قدر مقلاة فرن ثلاجة مكنسة دلو حبل
سلسلة مسمار مطرقة منشار مقص إبرة خيط زر قماش سجادة وسادة بطانية ستارة مظلة قبعة حذاء قميص سروال معطف حزام
خاتم عقد سوار تاج نظارة قلم دفتر كتاب رسالة ظرف طابع جريدة مجلة خريطة بوصلة لوحة صورة كاميرا هاتف حاسوب
شاشة مذياع تلفاز بطارية سلك محرك عجلة سيارة حافلة شاحنة دراجة قطار طائرة سفينة قارب غواصة صاروخ مركبة مرساة شراع
مجداف خوذة درع سيف رمح سهم مدفع بندقية قنبلة كنز ذهب فضة نحاس حديد ماس لؤلؤ ياقوت عملة دينار درهم
ملك ملكة أمير أميرة وزير جندي قائد فارس بطل لص شرطي قاضي محامي طبيب ممرض معلم طالب طباخ خباز نجار
حداد خياط حلاق فلاح صياد راع بحار طيار رائد عالم شاعر رسام مغني ممثل مهرج ساحر جاسوس حارس سائق تاجر
بائع ضيف جار صديق عدو طفل شيخ عجوز توأم عملاق قزم شبح وحش تنين غول عنقاء أسد نمر فهد ذئب
ثعلب دب فيل زرافة حصان حمار جمل بقرة ثور خروف ماعز قط كلب أرنب فأر سنجاب قرد غزال تمساح ثعبان
سلحفاة ضفدع سمكة حوت دلفين قرش أخطبوط سلطعون محار نسر صقر بومة غراب حمامة ببغاء طاووس دجاجة ديك بطة نعامة
نحلة نملة فراشة عنكبوت بعوضة ذبابة عقرب دودة خفاش تفاحة برتقال ليمون موز عنب رمان تين تمر بطيخ فراولة مشمش
خوخ جوز لوز زيتون طماطم بصل ثوم جزر بطاطا خيار خس فلفل ملح سكر عسل حليب جبن زبدة خبز أرز
عدس فول قهوة شاي عصير حلوى كعكة بيضة لحم دجاج شوربة صلصة زيت خل نعناع قرفة زعفران عين أذن أنف
فم سن لسان شفة رأس شعر وجه رقبة كتف ذراع يد إصبع ظفر صدر قلب معدة ظهر ركبة قدم عظم
دم جلد عضلة دماغ صوت ظل حلم ذاكرة سر لغز حكاية أسطورة قصة شعار علم سلام حرب نصر هزيمة عيد
عرس حفلة رحلة سفر مغامرة سباق لعبة كرة شطرنج نرد دمية بالون طبل عود ناي كمان بيانو جرس صفارة أغنية
رقصة موسيقى كتيبة جيش مخيم معسكر خندق خريف ربيع صيف شتاء فجر مساء ليل يوم أسبوع شهر سنة قرن تاريخ
مستقبل ماضي زمن رقم صفر مليون نصف ربع مثلث مربع دائرة نقطة خط لون أحمر أزرق أخضر أصفر أسود أبيض
ذهبي بنفسجي وردي رمادي برتقالي ضوء ظلام حرارة برد صمت ضجيج شرارة دخان رماد غبار بخار فقاعة مغناطيس عدسة منظار
تلسكوب مجهر ذرة كوكب مجرة مذنب نيزك فضاء قطب حدود جواز تذكرة هدية جائزة ميدالية شهادة وصفة دواء لقاح سم
ترياق ضمادة مرهم عطر صابون مشط فرشاة معجون منشفة حوض بانيو نافورة تمثال قبة منارة مئذنة هرم معبد أطلال كنيسة
دير قنطرة سد قناة خزان طاحونة مصنع منجم ورشة مخزن مكتب شركة بورصة سفارة قنصلية برلمان محكمة بلدية ساحة زقاق
رصيف إشارة موقف مرآب جراج
`;

export const WORDS_AR: readonly string[] = SOURCE_AR.trim().split(/\s+/);
