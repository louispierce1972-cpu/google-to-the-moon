// DL Name/Address Database + Random Generation
var _DL_M=['Marcus','Deshawn','Alejandro','Tyrell','Kenji','Connor','Bryson','Malik','Santiago','Xavier','Khalil','Trevor','Dominic','Isaiah','Elijah','Mateo','Jaylen','Nolan','Silas','Damien','Colton','Kai','Jaxon','Kian','Easton','Beckett','Emmett','Maverick','Declan','Sullivan','Barrett','Griffin','Andre','Terrence','Clayton','Russell','Franklin','Cedric','Dante','Lorenzo','Nelson','Garrett','Bryce','Joaquin','Eduardo','Rafael','Victor','Oscar','Raymond','Derek','Curtis','Warren','Leonard','Stanley','Bernard','Mitchell','Glenn','Roberto','Armando','Sergio','Ricardo','Enrique','Gustavo','Manuel','Roderick','Terrance','Kendrick','Lamar','Desmond','Clifford','Carlton','Winston','Reginald','Jerome'];
var _DL_F=['Aaliyah','Marisol','Destiny','Tatiana','Anaya','Brianna','Catalina','Essence','Fatima','Gabriela','Harmony','Imani','Jasmine','Kiara','Layla','Maya','Natalia','Priya','Rosalie','Selena','Tiana','Valentina','Ximena','Zara','Adriana','Bianca','Carmen','Desiree','Elena','Fernanda','Gianna','Helena','Iris','Jolene','Kendra','Luciana','Mireya','Noelle','Ophelia','Paloma','Regina','Savannah','Tabitha','Vanessa','Willa','Yasmin','Celeste','Dakota','Eloise','Genevieve','Isla','Juniper','Kaia','Lillian','Margot','Nadia','Penelope','Reese','Stella','Thea','Vera','Wren','Camille','Delilah','Emilia','Freya','Giselle','Ingrid','Leona','Miriam'];
var _DL_LN=['Nakamura','Gutierrez','Patel','Washington','Kim','Fernandez','Nguyen','Brooks','Campbell','Diaz','Ellis','Fitzgerald','Hernandez','Ibrahim','Kowalski','Martinez','Novak','Okafor','Petrov','Ramirez','Singh','Torres','Vasquez','Wu','Yang','Zimmerman','Alvarez','Blackwell','Cervantes','Delgado','Espinoza','Fuentes','Garza','Hawkins','Jensen','Keller','Lambert','Moreno','Nash','Ortega','Palmer','Quintero','Rivera','Thornton','Valencia','Watkins','Aguilar','Bennett','Chandler','Dominguez','Fletcher','Guerrero','Holland','Jimenez','Klein','Larson','Medina','Noriega','Ochoa','Pacheco','Reeves','Sandoval','Trujillo','Vargas','Whitfield','Xiong','Zavala','Contreras','Duarte','Estrada'];
var _DL_ST=['Sunset Blvd','Pacific Coast Hwy','El Camino Real','Mission Blvd','Broadway','Main St','Oak Ave','Maple Dr','Cedar Ln','Pine St','Willow Way','Birch Ct','Elm St','Sequoia Dr','Redwood Way','Magnolia Blvd','Palm Ave','Cypress St','Vista Del Mar','Camino Del Sol','La Paz Rd','Canyon Rd','Valley View Dr','Harbor Blvd','Ocean View Ter','Hillcrest Dr','Lakeshore Dr','Meadow Ln','Ridgeview Ave','Crestline Dr','Fairview St','Heritage Pkwy','Independence Ave','Jefferson Blvd','Kennedy Dr','Lincoln Way','Madison Ave','Monroe St','Roosevelt Blvd','Washington Ave'];
var _DL_CT=[{c:'LOS ANGELES',z:'90012'},{c:'SAN DIEGO',z:'92101'},{c:'SAN FRANCISCO',z:'94102'},{c:'SAN JOSE',z:'95112'},{c:'FRESNO',z:'93721'},{c:'SACRAMENTO',z:'95814'},{c:'LONG BEACH',z:'90802'},{c:'OAKLAND',z:'94607'},{c:'BAKERSFIELD',z:'93301'},{c:'ANAHEIM',z:'92805'},{c:'SANTA ANA',z:'92701'},{c:'RIVERSIDE',z:'92501'},{c:'STOCKTON',z:'95202'},{c:'IRVINE',z:'92618'},{c:'CHULA VISTA',z:'91910'},{c:'FREMONT',z:'94536'},{c:'MODESTO',z:'95354'},{c:'FONTANA',z:'92335'},{c:'MORENO VALLEY',z:'92553'},{c:'GLENDALE',z:'91205'},{c:'HUNTINGTON BCH',z:'92648'},{c:'SANTA CLARITA',z:'91350'},{c:'GARDEN GROVE',z:'92840'},{c:'OCEANSIDE',z:'92054'},{c:'RANCHO CUCAMONGA',z:'91730'},{c:'ONTARIO',z:'91764'},{c:'SANTA ROSA',z:'95401'},{c:'ELK GROVE',z:'95624'},{c:'CORONA',z:'92879'},{c:'LANCASTER',z:'93534'},{c:'PALMDALE',z:'93550'},{c:'SALINAS',z:'93901'},{c:'POMONA',z:'91766'},{c:'HAYWARD',z:'94541'},{c:'ESCONDIDO',z:'92025'},{c:'SUNNYVALE',z:'94086'},{c:'TORRANCE',z:'90501'},{c:'PASADENA',z:'91101'},{c:'ROSEVILLE',z:'95678'},{c:'CONCORD',z:'94520'},{c:'SPRING VALLEY',z:'91977'},{c:'MANHATTAN BCH',z:'90266'},{c:'CARLSBAD',z:'92008'},{c:'VISTA',z:'92081'},{c:'ENCINITAS',z:'92024'},{c:'BURBANK',z:'91502'},{c:'REDONDO BCH',z:'90277'},{c:'SAN CLEMENTE',z:'92672'}];

function _dlPick(a){return a[Math.floor(Math.random()*a.length)];}

function _dlRandomPerson(sex,ageMin,ageMax){
    var s=sex==='random'?(Math.random()>0.5?'M':'F'):(sex==='m'?'M':'F');
    var fn=_dlPick(s==='M'?_DL_M:_DL_F).toUpperCase();
    var ln=_dlPick(_DL_LN).toUpperCase();
    // DOB from age range
    var age=_dlRand(ageMin||21,ageMax||35);
    var now=new Date();
    var bYear=now.getFullYear()-age;
    var bMonth=_dlRand(1,12);
    var bDay=_dlRand(1,28);
    var dob=String(bMonth).padStart(2,'0')+'/'+String(bDay).padStart(2,'0')+'/'+bYear;
    // Address
    var houseNum=_dlRand(100,9999);
    var street=houseNum+' '+_dlPick(_DL_ST).toUpperCase();
    var ct=_dlPick(_DL_CT);
    // Physical
    var hArr,wMin,wMax;
    if(s==='M'){
        var hi=[65,66,67,68,69,70,71,72,73,74,75];
        var h=_dlPick(hi);
        var ft=Math.floor(h/12);var inch=h%12;
        hArr=ft+"'-"+String(inch).padStart(2,'0')+'"';
        wMin=140+Math.round((h-65)*4);wMax=wMin+40;
    }else{
        var hi=[60,61,62,63,64,65,66,67,68,69];
        var h=_dlPick(hi);
        var ft=Math.floor(h/12);var inch=h%12;
        hArr=ft+"'-"+String(inch).padStart(2,'0')+'"';
        wMin=110+Math.round((h-60)*3.5);wMax=wMin+35;
    }
    var weight=String(_dlRand(wMin,wMax));
    var hairW=s==='F'?['BLK','BLK','BRN','BRN','BRN','BLN','BLN','RED']:['BLK','BLK','BLK','BRN','BRN','BRN','BLN','RED','GRY'];
    var eyeW=['BRN','BRN','BRN','BRN','BLK','BLK','BLU','GRN','HZL','GRY'];
    if(age>50){hairW.push('GRY','GRY','WHI');}
    return {
        firstName:fn,lastName:ln,dob:dob,
        street:street,city:ct.c,state:'CA',zip:ct.z,
        sex:s,height:hArr,weight:weight,
        hair:_dlPick(hairW),eyes:_dlPick(eyeW),
        dlClass:'C',restrictions:'NONE',endorsements:'NONE',
        issueDate:'',dlNumber:'',dd:'',inventoryNum:'',expiration:'',
        photoData:null,signatureData:null,revDate:'08/29/2017'
    };
}
