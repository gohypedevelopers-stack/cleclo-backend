const INDIA_STATES = [
    { code: 'AN', name: 'Andaman and Nicobar Islands' },
    { code: 'AP', name: 'Andhra Pradesh' },
    { code: 'AR', name: 'Arunachal Pradesh' },
    { code: 'AS', name: 'Assam' },
    { code: 'BR', name: 'Bihar' },
    { code: 'CH', name: 'Chandigarh' },
    { code: 'CT', name: 'Chhattisgarh' },
    { code: 'DN', name: 'Dadra and Nagar Haveli and Daman and Diu' },
    { code: 'DL', name: 'Delhi' },
    { code: 'GA', name: 'Goa' },
    { code: 'GJ', name: 'Gujarat' },
    { code: 'HR', name: 'Haryana' },
    { code: 'HP', name: 'Himachal Pradesh' },
    { code: 'JK', name: 'Jammu and Kashmir' },
    { code: 'JH', name: 'Jharkhand' },
    { code: 'KA', name: 'Karnataka' },
    { code: 'KL', name: 'Kerala' },
    { code: 'LA', name: 'Ladakh' },
    { code: 'LD', name: 'Lakshadweep' },
    { code: 'MP', name: 'Madhya Pradesh' },
    { code: 'MH', name: 'Maharashtra' },
    { code: 'MN', name: 'Manipur' },
    { code: 'ML', name: 'Meghalaya' },
    { code: 'MZ', name: 'Mizoram' },
    { code: 'NL', name: 'Nagaland' },
    { code: 'OD', name: 'Odisha' },
    { code: 'PY', name: 'Puducherry' },
    { code: 'PB', name: 'Punjab' },
    { code: 'RJ', name: 'Rajasthan' },
    { code: 'SK', name: 'Sikkim' },
    { code: 'TN', name: 'Tamil Nadu' },
    { code: 'TG', name: 'Telangana' },
    { code: 'TR', name: 'Tripura' },
    { code: 'UP', name: 'Uttar Pradesh' },
    { code: 'UK', name: 'Uttarakhand' },
    { code: 'WB', name: 'West Bengal' }
];

const INDIA_CITIES_BY_STATE = {
    AN: [{ code: 'AN-PORT-BLAIR', name: 'Port Blair' }],
    AP: [
        { code: 'AP-VISAKHAPATNAM', name: 'Visakhapatnam' },
        { code: 'AP-VIJAYAWADA', name: 'Vijayawada' },
        { code: 'AP-GUNTUR', name: 'Guntur' },
        { code: 'AP-NELLORE', name: 'Nellore' },
        { code: 'AP-KURNOOL', name: 'Kurnool' },
        { code: 'AP-TIRUPATI', name: 'Tirupati' }
    ],
    AR: [
        { code: 'AR-ITANAGAR', name: 'Itanagar' },
        { code: 'AR-NAHARLAGUN', name: 'Naharlagun' },
        { code: 'AR-PASIGHAT', name: 'Pasighat' }
    ],
    AS: [
        { code: 'AS-GUWAHATI', name: 'Guwahati' },
        { code: 'AS-DIBRUGARH', name: 'Dibrugarh' },
        { code: 'AS-SILCHAR', name: 'Silchar' },
        { code: 'AS-JORHAT', name: 'Jorhat' },
        { code: 'AS-TEZPUR', name: 'Tezpur' }
    ],
    BR: [
        { code: 'BR-PATNA', name: 'Patna' },
        { code: 'BR-GAYA', name: 'Gaya' },
        { code: 'BR-BHAGALPUR', name: 'Bhagalpur' },
        { code: 'BR-MUZAFFARPUR', name: 'Muzaffarpur' },
        { code: 'BR-DARBHANGA', name: 'Darbhanga' }
    ],
    CH: [{ code: 'CH-CHANDIGARH', name: 'Chandigarh' }],
    CT: [
        { code: 'CT-RAIPUR', name: 'Raipur' },
        { code: 'CT-BHILAI', name: 'Bhilai' },
        { code: 'CT-BILASPUR', name: 'Bilaspur' },
        { code: 'CT-KORBA', name: 'Korba' }
    ],
    DN: [
        { code: 'DN-SILVASSA', name: 'Silvassa' },
        { code: 'DN-DAMAN', name: 'Daman' },
        { code: 'DN-DIU', name: 'Diu' }
    ],
    DL: [
        { code: 'DEL', name: 'Delhi' },
        { code: 'DL-NEW-DELHI', name: 'New Delhi' },
        { code: 'DL-DWARKA', name: 'Dwarka' },
        { code: 'DL-ROHINI', name: 'Rohini' }
    ],
    GA: [
        { code: 'GA-PANAJI', name: 'Panaji' },
        { code: 'GA-MARGAO', name: 'Margao' },
        { code: 'GA-VASCO-DA-GAMA', name: 'Vasco da Gama' },
        { code: 'GA-MAPUSA', name: 'Mapusa' }
    ],
    GJ: [
        { code: 'AMD', name: 'Ahmedabad' },
        { code: 'SUR', name: 'Surat' },
        { code: 'GJ-VADODARA', name: 'Vadodara' },
        { code: 'GJ-RAJKOT', name: 'Rajkot' },
        { code: 'GJ-BHAVNAGAR', name: 'Bhavnagar' },
        { code: 'GJ-JAMNAGAR', name: 'Jamnagar' }
    ],
    HR: [
        { code: 'HR-GURUGRAM', name: 'Gurugram' },
        { code: 'HR-FARIDABAD', name: 'Faridabad' },
        { code: 'HR-PANIPAT', name: 'Panipat' },
        { code: 'HR-AMBALA', name: 'Ambala' },
        { code: 'HR-HISAR', name: 'Hisar' }
    ],
    HP: [
        { code: 'HP-SHIMLA', name: 'Shimla' },
        { code: 'HP-DHARAMSHALA', name: 'Dharamshala' },
        { code: 'HP-SOLAN', name: 'Solan' },
        { code: 'HP-MANDI', name: 'Mandi' }
    ],
    JK: [
        { code: 'JK-SRINAGAR', name: 'Srinagar' },
        { code: 'JK-JAMMU', name: 'Jammu' },
        { code: 'JK-ANANTNAG', name: 'Anantnag' }
    ],
    JH: [
        { code: 'JH-RANCHI', name: 'Ranchi' },
        { code: 'JH-JAMSHEDPUR', name: 'Jamshedpur' },
        { code: 'JH-DHANBAD', name: 'Dhanbad' },
        { code: 'JH-BOKARO', name: 'Bokaro' }
    ],
    KA: [
        { code: 'BLR', name: 'Bengaluru' },
        { code: 'KA-MYSURU', name: 'Mysuru' },
        { code: 'KA-MANGALURU', name: 'Mangaluru' },
        { code: 'KA-HUBBALLI', name: 'Hubballi' },
        { code: 'KA-BELAGAVI', name: 'Belagavi' }
    ],
    KL: [
        { code: 'KL-THIRUVANANTHAPURAM', name: 'Thiruvananthapuram' },
        { code: 'KL-KOCHI', name: 'Kochi' },
        { code: 'KL-KOZHIKODE', name: 'Kozhikode' },
        { code: 'KL-THRISSUR', name: 'Thrissur' },
        { code: 'KL-KOLLAM', name: 'Kollam' }
    ],
    LA: [
        { code: 'LA-LEH', name: 'Leh' },
        { code: 'LA-KARGIL', name: 'Kargil' }
    ],
    LD: [{ code: 'LD-KAVARATTI', name: 'Kavaratti' }],
    MP: [
        { code: 'MP-INDORE', name: 'Indore' },
        { code: 'MP-BHOPAL', name: 'Bhopal' },
        { code: 'MP-JABALPUR', name: 'Jabalpur' },
        { code: 'MP-GWALIOR', name: 'Gwalior' },
        { code: 'MP-UJJAIN', name: 'Ujjain' }
    ],
    MH: [
        { code: 'MUM', name: 'Mumbai' },
        { code: 'PUNE', name: 'Pune' },
        { code: 'NAG', name: 'Nagpur' },
        { code: 'MH-NASHIK', name: 'Nashik' },
        { code: 'MH-THANE', name: 'Thane' },
        { code: 'MH-AURANGABAD', name: 'Aurangabad' }
    ],
    MN: [
        { code: 'MN-IMPHAL', name: 'Imphal' },
        { code: 'MN-THOUBAL', name: 'Thoubal' }
    ],
    ML: [
        { code: 'ML-SHILLONG', name: 'Shillong' },
        { code: 'ML-TURA', name: 'Tura' }
    ],
    MZ: [
        { code: 'MZ-AIZAWL', name: 'Aizawl' },
        { code: 'MZ-LUNGLEI', name: 'Lunglei' }
    ],
    NL: [
        { code: 'NL-KOHIMA', name: 'Kohima' },
        { code: 'NL-DIMAPUR', name: 'Dimapur' }
    ],
    OD: [
        { code: 'OD-BHUBANESWAR', name: 'Bhubaneswar' },
        { code: 'OD-CUTTACK', name: 'Cuttack' },
        { code: 'OD-ROURKELA', name: 'Rourkela' },
        { code: 'OD-PURI', name: 'Puri' }
    ],
    PY: [
        { code: 'PY-PUDUCHERRY', name: 'Puducherry' },
        { code: 'PY-KARAIKAL', name: 'Karaikal' },
        { code: 'PY-MAHE', name: 'Mahe' },
        { code: 'PY-YANAM', name: 'Yanam' }
    ],
    PB: [
        { code: 'PB-LUDHIANA', name: 'Ludhiana' },
        { code: 'PB-AMRITSAR', name: 'Amritsar' },
        { code: 'PB-JALANDHAR', name: 'Jalandhar' },
        { code: 'PB-PATIALA', name: 'Patiala' },
        { code: 'PB-MOHALI', name: 'Mohali' }
    ],
    RJ: [
        { code: 'JPR', name: 'Jaipur' },
        { code: 'RJ-JODHPUR', name: 'Jodhpur' },
        { code: 'RJ-UDAIPUR', name: 'Udaipur' },
        { code: 'RJ-KOTA', name: 'Kota' },
        { code: 'RJ-AJMER', name: 'Ajmer' }
    ],
    SK: [
        { code: 'SK-GANGTOK', name: 'Gangtok' },
        { code: 'SK-NAMCHI', name: 'Namchi' }
    ],
    TN: [
        { code: 'CHN', name: 'Chennai' },
        { code: 'TN-COIMBATORE', name: 'Coimbatore' },
        { code: 'TN-MADURAI', name: 'Madurai' },
        { code: 'TN-TIRUCHIRAPPALLI', name: 'Tiruchirappalli' },
        { code: 'TN-SALEM', name: 'Salem' }
    ],
    TG: [
        { code: 'HYD', name: 'Hyderabad' },
        { code: 'TG-WARANGAL', name: 'Warangal' },
        { code: 'TG-NIZAMABAD', name: 'Nizamabad' },
        { code: 'TG-KARIMNAGAR', name: 'Karimnagar' }
    ],
    TR: [
        { code: 'TR-AGARTALA', name: 'Agartala' },
        { code: 'TR-UDAIPUR', name: 'Udaipur' }
    ],
    UP: [
        { code: 'LKO', name: 'Lucknow' },
        { code: 'UP-KANPUR', name: 'Kanpur' },
        { code: 'UP-NOIDA', name: 'Noida' },
        { code: 'UP-GHAZIABAD', name: 'Ghaziabad' },
        { code: 'UP-VARANASI', name: 'Varanasi' },
        { code: 'UP-AGRA', name: 'Agra' },
        { code: 'UP-PRAYAGRAJ', name: 'Prayagraj' }
    ],
    UK: [
        { code: 'UK-DEHRADUN', name: 'Dehradun' },
        { code: 'UK-HARIDWAR', name: 'Haridwar' },
        { code: 'UK-HALDWANI', name: 'Haldwani' },
        { code: 'UK-ROORKEE', name: 'Roorkee' }
    ],
    WB: [
        { code: 'KOL', name: 'Kolkata' },
        { code: 'WB-HOWRAH', name: 'Howrah' },
        { code: 'WB-DURGAPUR', name: 'Durgapur' },
        { code: 'WB-SILIGURI', name: 'Siliguri' },
        { code: 'WB-ASANSOL', name: 'Asansol' }
    ]
};

module.exports = {
    INDIA_STATES,
    INDIA_CITIES_BY_STATE
};
