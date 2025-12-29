/**
 * Calendar Presets
 *
 * Built-in calendar configurations that users can choose from.
 */

import type { CalendarConfig } from './types.js'

/**
 * Coruscant Standard Calendar (Star Wars)
 *
 * The galactic standard calendar used throughout the Star Wars universe.
 * - 368 days per year (4 quarters of 92 days each)
 * - Each quarter has 91 regular days + 1 festival day
 * - 24-hour days, 60-minute hours
 * - Epoch: 0 BBY (Battle of Yavin)
 */
export const CORUSCANT_CALENDAR: CalendarConfig = {
  id: 'coruscant',
  name: 'Coruscant Standard Calendar',
  description: 'Galactic standard timekeeping (368 days, BBY/ABY)',
  minutesPerHour: 60,
  hoursPerDay: 24,
  minutesPerDay: 1440,
  daysPerYear: 368,
  minutesPerYear: 529920,
  subdivisions: [
    {
      id: 'quarter',
      name: 'Quarter',
      pluralName: 'Quarters',
      count: 4,
      daysPerUnitFixed: 92,
      labels: ['Conference Season', 'Gala Season', 'Recess Season', 'Budget Season'],
      subdivisions: [
        {
          id: 'week',
          name: 'Week',
          pluralName: 'Weeks',
          count: 13,
          daysPerUnitFixed: 7,
          labelFormat: 'Week {n}',
        },
      ],
    },
  ],
  eras: {
    positive: 'ABY',
    negative: 'BBY',
  },
  display: {
    defaultFormat: '<% if (holiday) { %><%= holiday %><% } else { %>Day <%= dayOfQuarter %><% } %>, <%= quarter %> (Q<%= quarterNumber %>), <%= year %> <%= era %> at <%= hour %>:<%= minute %>',
    shortFormat: 'Q<%= quarterNumber %> Day <%= dayOfQuarter %>, <%= year %> <%= era %>',
    includeTimeByDefault: true,
    hourFormat: '24',
  },
  // Festival Day at the end of each quarter (last day = day 92)
  holidays: [
    { type: 'lastDay', name: 'Festival Day', subdivisionId: 'quarter', unit: 1 },
    { type: 'lastDay', name: 'Festival Day', subdivisionId: 'quarter', unit: 2 },
    { type: 'lastDay', name: 'Festival Day', subdivisionId: 'quarter', unit: 3 },
    { type: 'lastDay', name: 'Festival Day', subdivisionId: 'quarter', unit: 4 },
  ],
}

/**
 * Simple 365-Day Calendar
 *
 * A straightforward calendar for stories that don't need complex subdivisions.
 * - 365 days per year
 * - No subdivisions (just day of year)
 * - 24-hour days, 60-minute hours
 * - Generic era system (BE/AE)
 */
export const SIMPLE_365_CALENDAR: CalendarConfig = {
  id: 'simple365',
  name: 'Simple 365-Day Calendar',
  description: 'Basic 365-day year, no subdivisions',
  minutesPerHour: 60,
  hoursPerDay: 24,
  minutesPerDay: 1440,
  daysPerYear: 365,
  minutesPerYear: 525600,
  subdivisions: [],
  eras: {
    positive: 'AE',
    negative: 'BE',
  },
  display: {
    defaultFormat: 'Day <%= dayOfYear %>, Year <%= year %> <%= era %> at <%= hour %>:<%= minute %>',
    shortFormat: 'Day <%= dayOfYear %>, Year <%= year %> <%= era %>',
    includeTimeByDefault: true,
    hourFormat: '24',
  },
}

/**
 * Gregorian Calendar
 *
 * The standard civil calendar used worldwide.
 * - 365 days per year (no leap year logic)
 * - 12 months with standard day counts
 * - 24-hour days, 60-minute hours
 * - Era: CE/BCE
 */
export const GREGORIAN_CALENDAR: CalendarConfig = {
  id: 'gregorian',
  name: 'Gregorian Calendar',
  description: 'Standard 12-month solar calendar (365 days)',
  minutesPerHour: 60,
  hoursPerDay: 24,
  minutesPerDay: 1440,
  daysPerYear: 365,
  minutesPerYear: 525600,
  subdivisions: [
    {
      id: 'month',
      name: 'Month',
      pluralName: 'Months',
      count: 12,
      daysPerUnit: [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31],
      labels: [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December',
      ],
      useCustomLabels: true,
    },
    // Standard 7-day week cycle (parallel, non-nesting)
    {
      id: 'weekday',
      name: 'Weekday',
      pluralName: 'Weekdays',
      count: 7,
      isCycle: true,
      epochStartsOnUnit: 1, // Year 0, Day 1 is Monday (index 1)
      labels: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    },
  ],
  eras: {
    positive: 'CE',
    negative: 'BCE',
  },
  display: {
    defaultFormat: '<%= weekday %>, <%= month %> <%= dayOfMonth %>, <%= year %> <%= era %> at <%= hour %>:<%= minute %>',
    shortFormat: '<%= month %> <%= dayOfMonth %>, <%= year %> <%= era %>',
    includeTimeByDefault: true,
    hourFormat: '24',
  },
}

/**
 * Islamic/Hijri Calendar
 *
 * The lunar calendar used in Islamic tradition.
 * - 354 days per year (12 lunar months)
 * - Months alternate between 30 and 29 days
 * - Seasons drift through the calendar over ~33 years
 * - Era: AH (Anno Hegirae) / BH (Before Hijra)
 */
export const ISLAMIC_CALENDAR: CalendarConfig = {
  id: 'islamic',
  name: 'Islamic (Hijri) Calendar',
  description: 'Lunar calendar with 12 months (354 days, seasons drift)',
  minutesPerHour: 60,
  hoursPerDay: 24,
  minutesPerDay: 1440,
  daysPerYear: 354,
  minutesPerYear: 509760,
  subdivisions: [
    {
      id: 'month',
      name: 'Month',
      pluralName: 'Months',
      count: 12,
      daysPerUnit: [30, 29, 30, 29, 30, 29, 30, 29, 30, 29, 30, 29],
      labels: [
        'Muharram',
        'Safar',
        "Rabi' al-Awwal",
        "Rabi' al-Thani",
        'Jumada al-Awwal',
        'Jumada al-Thani',
        'Rajab',
        "Sha'ban",
        'Ramadan',
        'Shawwal',
        "Dhu al-Qi'dah",
        'Dhu al-Hijjah',
      ],
      useCustomLabels: true,
    },
  ],
  eras: {
    positive: 'AH',
    negative: 'BH',
  },
  display: {
    defaultFormat: '<%= dayOfMonth %> <%= month %>, <%= year %> <%= era %> at <%= hour %>:<%= minute %>',
    shortFormat: '<%= dayOfMonth %> <%= month %>, <%= year %> <%= era %>',
    includeTimeByDefault: true,
    hourFormat: '24',
  },
}

/**
 * Medieval European Calendar
 *
 * A medieval calendar with lunisolar holiday calculation.
 * - 365 days per year (Julian-like)
 * - 12 months with standard day counts
 * - 7-day week cycle
 * - 29-day lunar cycle for Easter calculation
 * - Era: AD (Anno Domini) / BC (Before Christ)
 *
 * Easter is calculated as: first Sunday after the first full moon on or after March 21
 * Related holidays (Ash Wednesday, Pentecost, etc.) are calculated as offsets from Easter.
 */
export const MEDIEVAL_CALENDAR: CalendarConfig = {
  id: 'medieval',
  name: 'Medieval European Calendar',
  description: 'Julian calendar with lunar cycle for Easter (365 days)',
  minutesPerHour: 60,
  hoursPerDay: 24,
  minutesPerDay: 1440,
  daysPerYear: 365,
  minutesPerYear: 525600,
  subdivisions: [
    {
      id: 'month',
      name: 'Month',
      pluralName: 'Months',
      count: 12,
      daysPerUnit: [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31],
      labels: [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December',
      ],
      useCustomLabels: true,
    },
    // 7-day week cycle
    {
      id: 'weekday',
      name: 'Weekday',
      pluralName: 'Weekdays',
      count: 7,
      isCycle: true,
      epochStartsOnUnit: 1, // Year 0, Day 1 is Monday
      labels: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    },
    // 29-day lunar cycle for Easter calculation
    // Full moon occurs at day 15 (index 14)
    {
      id: 'lunar',
      name: 'Moon Phase',
      pluralName: 'Moon Phases',
      count: 29,
      isCycle: true,
      epochStartsOnUnit: 0, // New moon on Day 1 of Year 0
      labels: [
        'New Moon',
        'Waxing Crescent 1',
        'Waxing Crescent 2',
        'Waxing Crescent 3',
        'Waxing Crescent 4',
        'Waxing Crescent 5',
        'Waxing Crescent 6',
        'First Quarter',
        'Waxing Gibbous 1',
        'Waxing Gibbous 2',
        'Waxing Gibbous 3',
        'Waxing Gibbous 4',
        'Waxing Gibbous 5',
        'Waxing Gibbous 6',
        'Full Moon',
        'Waning Gibbous 1',
        'Waning Gibbous 2',
        'Waning Gibbous 3',
        'Waning Gibbous 4',
        'Waning Gibbous 5',
        'Waning Gibbous 6',
        'Last Quarter',
        'Waning Crescent 1',
        'Waning Crescent 2',
        'Waning Crescent 3',
        'Waning Crescent 4',
        'Waning Crescent 5',
        'Waning Crescent 6',
        'Waning Crescent 7',
      ],
    },
  ],
  eras: {
    positive: 'AD',
    negative: 'BC',
  },
  display: {
    defaultFormat:
      '<%= weekday %>, <%= month %> <%= dayOfMonth %>, <%= year %> <%= era %><% if (holiday) { %> (<%= holiday %>)<% } %> at <%= hour %>:<%= minute %>',
    shortFormat: '<%= month %> <%= dayOfMonth %>, <%= year %> <%= era %>',
    includeTimeByDefault: true,
    hourFormat: '24',
  },
  holidays: [
    // === CHRISTMAS AND CHRISTMAS SEASON ===
    // Christmas must come first as other holidays depend on it
    { type: 'fixed', name: 'Christmas', description: 'Nativity of Jesus Christ, born in Bethlehem and laid in a manger. Fixed to December 25 (winter solstice) in the 4th century, nine months after the Annunciation. Begins Christmastide, twelve days of feasting culminating on Twelfth Night', subdivisionId: 'month', unit: 12, day: 25 },
    { type: 'offsetFromHoliday', name: 'Circumcision of Christ', description: 'Eight days after birth, Jesus was circumcised and named according to Jewish law (Brit milah). A common subject in Christian art from the 10th century, depicted in altarpieces through the Renaissance. Several relics claiming to be the Holy Prepuce surfaced in medieval times', baseHoliday: 'Christmas', offsetDays: 7 },
    { type: 'offsetFromHoliday', name: 'Epiphany', description: "Also called Three Kings' Day or Little Christmas. Commemorates the visit of the Magi to the Christ Child, Christ's manifestation to the Gentiles. The eve (January 5) is Twelfth Night; the Monday after is Plough Monday. In Eastern tradition, commemorates Christ's baptism in the Jordan", baseHoliday: 'Christmas', offsetDays: 12 },

    // === FEBRUARY ===
    { type: 'fixed', name: 'Candlemas', description: 'Presentation of Jesus at the Temple and Purification of Mary, 40 days after Christmas. Concludes the Christmas-Epiphany season. Candles are blessed and used for the rest of the year, symbolizing Christ as the Light of the World. Some countries remove Christmas decorations on this day', subdivisionId: 'month', unit: 2, day: 2 },
    { type: 'fixed', name: 'St Matthias', description: 'Apostle chosen by lot to replace Judas Iscariot after the Ascension. Feast added to Roman Calendar in 11th century. Relics claimed by Abbey of Santa Giustina in Padua, Abbey of St Matthias in Trier, and castle of Gonio-Apsaros in Georgia', subdivisionId: 'month', unit: 2, day: 24 },

    // === MARCH ===
    { type: 'fixed', name: 'St Gregory', description: 'Pope Gregory the Great (died 604), Doctor of the Church. Sent missionaries to convert England, reformed the liturgy, and authored the Divine Liturgy of the Presanctified Gifts still used in Eastern churches during Lent', subdivisionId: 'month', unit: 3, day: 12 },
    { type: 'fixed', name: 'St Benedict', description: 'Father of Western monasticism, founder of Monte Cassino and the Benedictine order (died 547). Patron of Europe and of speleologists. Buried in the same tomb as his sister, St Scholastica', subdivisionId: 'month', unit: 3, day: 21 },
    { type: 'fixed', name: 'Annunciation', description: "Lady Day - Archangel Gabriel announces to Mary she will conceive and bear the Son of God. Set on the spring equinox, nine months before Christmas. Traditional start of the English calendar year until 1752. A key subject in medieval and Renaissance art", subdivisionId: 'month', unit: 3, day: 25 },

    // === APRIL ===
    { type: 'fixed', name: 'St George', description: 'Roman soldier martyred in the Diocletianic Persecution. Patron saint of England, Ethiopia, Georgia, Portugal, Catalonia, Aragon, and many cities. The legendary dragon-slayer became one of the most venerated saints in medieval Christendom', subdivisionId: 'month', unit: 4, day: 23 },

    // === MAY ===
    { type: 'fixed', name: 'Sts Philip and James', description: "Two of the Twelve Apostles. Philip of Bethsaida led others to Christ; James the Less, Jesus's relative, became first Bishop of Jerusalem and author of the Epistle of James. Both were martyred. Also coincides with May Day celebrations", subdivisionId: 'month', unit: 5, day: 1 },

    // === JUNE ===
    { type: 'fixed', name: 'St Barnabas', description: "Cypriot Levite and apostle, companion of Paul on missionary journeys to the Gentiles. Participated in the Council of Jerusalem (c. 49 AD). Cousin of Mark the Evangelist. Traditionally martyred at Salamis and founder of the Cypriot Church", subdivisionId: 'month', unit: 6, day: 11 },
    { type: 'fixed', name: 'Nativity of St John the Baptist', description: "Also called Johnmas or Midsummer's Day. One of the highest-ranking feasts, celebrating the birth of the Forerunner as told in Luke's Gospel. Traditionally marked with bonfires, feasting, and the gathering of herbs believed to have special powers on this night", subdivisionId: 'month', unit: 6, day: 24 },
    { type: 'fixed', name: 'Sts Peter and Paul', description: 'Solemnity honoring the martyrdom in Rome of the two foremost apostles. Peter, the rock upon whom Christ built his Church; Paul, apostle to the Gentiles. An ancient feast marking either their death or the translation of their relics', subdivisionId: 'month', unit: 6, day: 29 },

    // === JULY ===
    { type: 'fixed', name: 'St Margaret', description: 'Virgin martyr of Antioch, known as Marina in Eastern tradition. Patron saint of childbirth and pregnant women. Included in the Roman calendar from the 12th century. The Coptic church holds a relic believed to be her right hand in Cairo', subdivisionId: 'month', unit: 7, day: 20 },
    { type: 'fixed', name: 'St Mary Magdalene', description: "One of Christ's most prominent disciples, called the 'Apostle to the Apostles.' First witness to the Resurrection and the one who announced it to the other disciples. Venerated in Catholic, Orthodox, and Anglican traditions", subdivisionId: 'month', unit: 7, day: 22 },
    { type: 'fixed', name: 'St James the Greater', description: 'Apostle and brother of John, believed martyred on this date in 44 AD. Patron saint of pilgrims and of Spain; his shrine at Santiago de Compostela became one of the most important medieval pilgrimage destinations. National Day of Galicia', subdivisionId: 'month', unit: 7, day: 25 },

    // === AUGUST ===
    { type: 'fixed', name: 'Lammas', description: "From Old English 'loaf-mass.' Festival blessing the First Fruits of harvest, with a loaf brought to church. Falls halfway between summer solstice and autumn equinox. Church processions bless bakeries. Same date as the Gaelic festival Lughnasadh", subdivisionId: 'month', unit: 8, day: 1 },
    { type: 'fixed', name: 'St Lawrence', description: "Deacon martyred on a gridiron, third patron of Rome after Peter and Paul. One of the most venerated saints since the 4th century. Patron of librarians, archivists, comedians, and cooks. The Perseid meteor shower is called the 'Tears of St Lawrence'", subdivisionId: 'month', unit: 8, day: 10 },
    { type: 'fixed', name: 'Assumption of the Virgin', description: "Mary's heavenly birthday - her bodily assumption into Heaven. A Holy Day of Obligation since the 6th century. In Italy called Ferragosto, possibly from the Roman 'Feriae Augusti.' Preceded by a fourteen-day fast in Eastern tradition", subdivisionId: 'month', unit: 8, day: 15 },
    { type: 'fixed', name: 'St Bartholomew', description: 'One of the Twelve Apostles, traditionally martyred by being flayed alive. Often depicted in art holding his own skin. The St Bartholomew Day Massacre of 1572 occurred on this feast, killing thousands of French Huguenots', subdivisionId: 'month', unit: 8, day: 24 },
    { type: 'fixed', name: 'Beheading of St John the Baptist', description: 'One of the oldest feasts in both Eastern and Western liturgies. Commemorates his execution by Herod Antipas. Always observed with strict fasting; the pious will not eat from flat plates, use knives, or eat round food on this day', subdivisionId: 'month', unit: 8, day: 29 },

    // === SEPTEMBER ===
    { type: 'fixed', name: 'Nativity of the Virgin', description: "Also called Marymas. Birthday of the Blessed Virgin Mary, set nine months after the Immaculate Conception (Dec 8). Celebrated with an Octave since Pope Innocent IV established it in 1243", subdivisionId: 'month', unit: 9, day: 8 },
    { type: 'fixed', name: 'Holy Rood Day', description: "Also called Roodmas or Crouchmas. Commemorates the True Cross, first shown to the people in 335 at the consecration of the Holy Sepulchre basilica. Also marks Emperor Heraclius's recovery of the Cross in 628. Celebrates the Cross itself as the sign of salvation", subdivisionId: 'month', unit: 9, day: 14 },
    { type: 'fixed', name: 'St Matthew', description: 'Apostle and Evangelist, called from his work as a tax collector. Traditional author of the first Gospel. Preached in Judea before going to other countries. His tomb is in the crypt of Salerno Cathedral in southern Italy', subdivisionId: 'month', unit: 9, day: 21 },
    { type: 'fixed', name: 'Michaelmas', description: 'Feast of Saints Michael, Gabriel and Raphael. One of the four quarter days of the English financial, judicial and academic year. Michael is honored as greatest of angels for defeating Satan in the war in heaven', subdivisionId: 'month', unit: 9, day: 29 },

    // === OCTOBER ===
    { type: 'fixed', name: 'Sts Simon and Jude', description: "Two Apostles whose names appear together in the Canon of the Mass. Simon called 'the Zealot' or 'the Canaanite'; Jude (Thaddeus) is patron of lost causes and desperate situations. Traditionally believed to have preached together in Persia", subdivisionId: 'month', unit: 10, day: 28 },

    // === NOVEMBER ===
    { type: 'fixed', name: 'All Saints Day', description: "Also called All Hallows' Day or Hallowmas. Honors all saints, known and unknown. Begins at vespers on October 31 (All Hallows' Eve/Halloween). Part of Allhallowtide with All Souls' Day. Celebrates the 'Church triumphant' - those who have attained heaven", subdivisionId: 'month', unit: 11, day: 1 },
    { type: 'fixed', name: 'All Souls Day', description: "Commemoration of All the Faithful Departed. Third day of Allhallowtide, standardized to November 2 by St Odilo of Cluny in the 10th century. Families visit graveyards to pray and decorate graves with flowers, candles and incense", subdivisionId: 'month', unit: 11, day: 2 },
    { type: 'fixed', name: 'Martinmas', description: "Feast of St Martin of Tours. Traditional day for slaughtering livestock for winter (November was Old English 'Blōtmōnaþ' - sacrifice month). Goose is eaten because cackling geese betrayed Martin hiding from ordination. First wine of the season; Martin credited with spreading winemaking in Touraine", subdivisionId: 'month', unit: 11, day: 11 },
    { type: 'fixed', name: 'St Cecilia', description: "Roman virgin martyr, patroness of music because she 'sang in her heart to the Lord' as musicians played at her wedding. Named in the Canon of the Mass. Her feast occasions concerts and musical festivals. Santa Cecilia in Trastevere stands on the site of her house", subdivisionId: 'month', unit: 11, day: 22 },
    { type: 'fixed', name: 'St Andrew', description: "Apostle who introduced his brother Peter to Jesus. Scotland's national day; also patron of Greece, Romania, Russia, Ukraine, and Cyprus. Marks the beginning of the Saint Andrew Christmas Novena, a traditional Advent devotion", subdivisionId: 'month', unit: 11, day: 30 },

    // === DECEMBER ===
    { type: 'fixed', name: 'St Nicholas', description: "Bishop of Myra, origin of Santa Claus traditions. Children leave shoes or stockings to be filled with gifts; bad children receive twigs or coal. In Germany and Poland, boys dressed as bishops begged alms for the poor. Falls within Advent", subdivisionId: 'month', unit: 12, day: 6 },
    { type: 'fixed', name: 'St Lucy', description: "Virgin martyr whose name means 'light.' Legend says she wore a candle-lit wreath to bring food to Christians hiding in catacombs. Once coincided with the winter solstice. In Scandinavia, girls in white with candle crowns carry saffron buns in procession, bringing Christ's light into darkness", subdivisionId: 'month', unit: 12, day: 13 },
    { type: 'fixed', name: 'St Thomas the Apostle', description: "Called 'Doubting Thomas' for demanding to see Christ's wounds before believing in the Resurrection. Traditionally evangelized India, where the Malankara Church marks both December 18 (when he was lanced) and December 21 (when he died). Feast placed in Advent since the 9th century", subdivisionId: 'month', unit: 12, day: 21 },
    // Christmas is defined at the top of the holidays list (other holidays depend on it)
    { type: 'fixed', name: 'St Stephen', description: "The first Christian martyr (protomartyr), stoned to death. Second day of Christmastide. Also called Boxing Day in Britain or Wren Day in Ireland, where it was traditional to hunt a wren and parade it on a holly-decorated staff", subdivisionId: 'month', unit: 12, day: 26 },
    { type: 'fixed', name: 'St John the Evangelist', description: "Apostle, author of the Fourth Gospel, believed the only apostle not martyred. One of the three 'pillars' of Jerusalem with Peter and James. Exiled to Patmos where tradition says he wrote Revelation. Third day of Christmastide. Freemasons use this day for installation of Grand Masters", subdivisionId: 'month', unit: 12, day: 27 },
    { type: 'fixed', name: 'Holy Innocents', description: "Also called Childermas. Commemorates the children killed by Herod seeking the Christ child. Fourth day of Christmastide. In the Middle Ages, a day of role reversal with boy bishops presiding over services. Considered deeply unlucky; no new projects should start on this day of the week for the whole year", subdivisionId: 'month', unit: 12, day: 28 },
    { type: 'fixed', name: 'St Thomas Becket', description: "Archbishop of Canterbury (1162-1170), formerly Henry II's Lord Chancellor. Murdered in his cathedral by four knights after conflict with the king over Church rights. Canonised just two years later. Canterbury became one of Europe's greatest pilgrimage sites", subdivisionId: 'month', unit: 12, day: 29 },
    { type: 'fixed', name: 'St Silvester', description: "Pope (314-335) credited in medieval legend with converting Emperor Constantine. Seventh day of Christmastide, coinciding with New Year's Eve since the Gregorian calendar. Marked by Watchnight Mass at midnight, fireworks, and feasting", subdivisionId: 'month', unit: 12, day: 31 },

    // === EASTER AND MOVEABLE FEASTS ===
    // Easter: first Sunday after first full moon on or after March 21
    {
      type: 'computed',
      name: 'Easter',
      description: 'Resurrection of Jesus Christ - the greatest feast of the Christian year',
      steps: [
        { type: 'fixed', subdivisionId: 'month', unit: 3, day: 21 },
        { type: 'findInCycle', cycleId: 'lunar', dayInCycle: 14, direction: 'onOrAfter' },
        { type: 'findInCycle', cycleId: 'weekday', dayInCycle: 0, direction: 'onOrAfter' },
      ],
    },

    // Pre-Lenten and Lenten season
    { type: 'offsetFromHoliday', name: 'Shrove Tuesday', description: 'Last day before Lent - confession and absolution, feasting on eggs and meat before the fast', baseHoliday: 'Easter', offsetDays: -47 },
    { type: 'offsetFromHoliday', name: 'Ash Wednesday', description: 'First day of Lent - ashes placed on foreheads as sign of penitence', baseHoliday: 'Easter', offsetDays: -46 },

    // Holy Week
    { type: 'offsetFromHoliday', name: 'Palm Sunday', description: "Commemorates Christ's triumphal entry into Jerusalem", baseHoliday: 'Easter', offsetDays: -7 },
    { type: 'offsetFromHoliday', name: 'Maundy Thursday', description: 'Last Supper of Christ with his disciples, washing of feet', baseHoliday: 'Easter', offsetDays: -3 },
    { type: 'offsetFromHoliday', name: 'Good Friday', description: 'Crucifixion of Jesus Christ - day of fasting and mourning', baseHoliday: 'Easter', offsetDays: -2 },
    { type: 'offsetFromHoliday', name: 'Holy Saturday', description: 'Christ lies in the tomb - vigil before Easter', baseHoliday: 'Easter', offsetDays: -1 },

    // Rogation and Ascension
    { type: 'offsetFromHoliday', name: 'Rogation Sunday', description: 'Fifth Sunday after Easter - beginning of Rogationtide', baseHoliday: 'Easter', offsetDays: 35 },
    { type: 'offsetFromHoliday', name: 'Rogation Monday', description: 'Processions to bless the fields and pray for good harvest', baseHoliday: 'Easter', offsetDays: 36 },
    { type: 'offsetFromHoliday', name: 'Rogation Tuesday', description: 'Beating the bounds - walking parish boundaries with prayers', baseHoliday: 'Easter', offsetDays: 37 },
    { type: 'offsetFromHoliday', name: 'Rogation Wednesday', description: 'Final day of Rogationtide processions', baseHoliday: 'Easter', offsetDays: 38 },
    { type: 'offsetFromHoliday', name: 'Ascension Day', description: 'Christ ascends to heaven forty days after the Resurrection', baseHoliday: 'Easter', offsetDays: 39 },

    // Pentecost and after
    { type: 'offsetFromHoliday', name: 'Whitsunday', description: 'Pentecost - descent of the Holy Spirit upon the apostles', baseHoliday: 'Easter', offsetDays: 49 },
    { type: 'offsetFromHoliday', name: 'Whit Monday', description: 'Second day of Whitsuntide celebrations', baseHoliday: 'Easter', offsetDays: 50 },
    { type: 'offsetFromHoliday', name: 'Trinity Sunday', description: 'Celebrates the Holy Trinity - Father, Son, and Holy Spirit', baseHoliday: 'Easter', offsetDays: 56 },
    { type: 'offsetFromHoliday', name: 'Corpus Christi', description: 'Feast of the Body of Christ - celebrates the Real Presence in the Eucharist', baseHoliday: 'Easter', offsetDays: 60 },
  ],
}

/**
 * All available calendar presets
 */
export const CALENDAR_PRESETS: Record<string, CalendarConfig> = {
  gregorian: GREGORIAN_CALENDAR,
  islamic: ISLAMIC_CALENDAR,
  medieval: MEDIEVAL_CALENDAR,
  coruscant: CORUSCANT_CALENDAR,
  simple365: SIMPLE_365_CALENDAR,
}

/**
 * Get a calendar preset by ID
 * @param id - Calendar preset ID
 * @returns Calendar config, or undefined if not found
 */
export function getCalendarPreset(id: string): CalendarConfig | undefined {
  return CALENDAR_PRESETS[id]
}

/**
 * Get all available calendar presets
 * @returns Array of calendar configs
 */
export function listCalendarPresets(): CalendarConfig[] {
  return Object.values(CALENDAR_PRESETS)
}

/**
 * Get default calendar preset (Simple365)
 * @returns Simple 365-day calendar config
 */
export function getDefaultCalendarPreset(): CalendarConfig {
  return SIMPLE_365_CALENDAR
}
