//global variables
var map;
var infoWindow;
var autocomplete;
var locationMarker;
var markers = [];

//load default configurations
var MARKERS_PATH = 'https://maps.gstatic.com/intl/en_us/mapfiles/marker_green';
var DEFAULT_POS = {lat : 28.6139,  lng : 77.2090}; 
var DEFAULT_ZOOM = 10;

//add api key 
var API_KEY = getAPIKey();
var map_script = document.createElement('script');
map_script.setAttribute('src','https://maps.googleapis.com/maps/api/js?key='+API_KEY+'&libraries=places&callback=initMap&v=3.5&sensor=false');
map_script.setAttribute("async", "");
map_script.setAttribute("defer", "");
document.body.appendChild(map_script);


// WILL WORK IN SALESFORCE ORG
//check if page is running on Salesforce1/Service console/Sales console
/*var isSF1 = false;
var isInConsole = false;
if( typeof sforce != "undefined" && sforce){
    if(sforce.one){
        isSF1 = true
    }
    
    if(sforce.console && sforce.console.isInConsole()){
        isInConsole = true;
    }
}
var isCommunity = '{!$CurrentPage.parameters.isCommunity}';*/

/**
 * function to get api key related to platform
**/
function getAPIKey(){
    var device = getMobileOperatingSystem();
    if(device == 'IOS'){
        return 'AIzaSyC3mOmyO7aJEM2q-4zr0sX-aSwreqHS5UY';
    }else if(device == 'Android'){
        return 'AIzaSyBKuWBi1Lu-e985IfPXtcQYyfQtJAPzz5c';
    }else{
        return 'AIzaSyCh_4KFc6hLgP33fdHRo698A6Q_pfDhIWY';
    }
}

/**
 * Function to check useragent
**/
function getMobileOperatingSystem() {
  var userAgent = navigator.userAgent || navigator.vendor || window.opera;
  if( userAgent.match( /iPad/i ) || userAgent.match( /iPhone/i ) || userAgent.match( /iPod/i ) )
  {
    return 'IOS';
  }
  else if( userAgent.match( /Android/i ) )
  {
    return 'Android';
  }
  else
  {
    return 'unknown';
  }
}


function getCurrentLocation(){
  showPopup('Fetching current location...');
  
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(function(position) {
      pos = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };
      
      map.setCenter(pos);
      drawMarker(pos, map, null, currentSearchedLocationContent('Current Location', pos));
      
      //set currentLocation button as selected.
      
      var secondChild = document.getElementById("second-child");
      secondChild.style['background-position'] = '-144px 0';
      //find case with current location
      if(getParameterByName('search') == 'true'){
        findNeabyCases(pos);
      }
      stopCurrentButtonAnimation();
    }, function() {
      handleLocationError(true, map.getCenter());
    });
  } else {
    // Browser doesn't support Geolocation
    handleLocationError(false, map.getCenter());
  }
}



function handleLocationError(browserHasGeolocation, pos) {
  drawMarker(pos, map, null, currentSearchedLocationContent(browserHasGeolocation ?
                        'Error: The Geolocation service failed. Displaying default location.' :
                        'Error: Your browser doesn\'t support geolocation. Displaying default location.', pos));
  // mark as not selected
  var secondChild = document.getElementById("second-child");
  secondChild.style['background-position'] = '0 0';
  
  //find nearby cases with default location
  if(getParameterByName('search') == 'true'){
    findNeabyCases(pos);
  }
  
  stopCurrentButtonAnimation();
}

function drawMarker(pos, map, icon, content){
    if(locationMarker == null){
        locationMarker = new google.maps.Marker({
            position: pos,
            map: map,
            icon : icon,
            draggable: true
        });
    }else{
        locationMarker.setPosition(pos);
    }
    
    google.maps.event.addListener(locationMarker, 'dragend', function() {
        var markerPos = { 
            lat: locationMarker.position.lat(), 
            lng: locationMarker.position.lng()
            
        };
        geocodePosition(locationMarker, markerPos);
    });
    
    setInfoWindow(content, locationMarker);
}

var service;

function getPlaceDetails(placeId){
    service = new google.maps.places.PlacesService(map);
    
    service.getDetails({
       placeId:placeId
        }, function(place, status) {
        if (status === google.maps.places.PlacesServiceStatus.OK) {
                var pos = {lat: place.geometry.location.lat(), lng: place.geometry.location.lng()};
                drawMarker(pos, map, null, currentSearchedLocationContent(place.name, pos));
                if(getParameterByName('search') == 'true'){
                    findNeabyCases(pos);
                }
            }
        });
}

function geocodePosition(marker, pos) {
  var geocoder = new google.maps.Geocoder();
  geocoder.geocode({
    latLng: pos
  }, function(responses) {
    if (responses && responses.length > 0) {
        getPlaceDetails(responses[0].place_id);
    } else {
        showPopup('Cannot determine name,address at this location.');
        drawMarker(pos, map, null, currentSearchedLocationContent('Undetermined', pos));
        if(getParameterByName('search') == 'true'){
            findNeabyCases(pos);
        }
    }
  });
}

function setInfoWindow(content, marker){
  if(infoWindow == null){
      infoWindow = new google.maps.InfoWindow();
  }
  
  content = '<div style="overflow:hidden;line-height:1.35;min-width:200px;">'+content+'</div>';
  infoWindow.setContent(content);
  infoWindow.open(map, marker);
}

function placeChanged() {
  if(infoWindow){infoWindow.close()};
  
  var place = autocomplete.getPlace();
  if (!place.geometry) {
      showPopup("Autocomplete's returned place contains no geometry");
      return;
  }
  
  var pos = {lat: place.geometry.location.lat(), lng: place.geometry.location.lng()};

  drawMarker(pos, map, null, currentSearchedLocationContent(place.name, pos));
  map.setCenter(pos);
  map.setZoom(DEFAULT_ZOOM);
  
  if(getParameterByName('search') == 'true'){
    findNeabyCases(pos);
  }
}

function currentSearchedLocationContent(name, pos){
    var content = '<div><strong>'+name+'</strong></div>';
    if(getParameterByName('search') != 'true'){
        content += '<br/>';
        content += '<center><a href="javascript:void(0)" id="info-link" class="set-button" onclick="setLocation(\''+null+'\',\''+pos.lat+'\',\''+pos.lng+'\')">Set this location</a><center>';
    }
    return content;
}

function findNeabyCases(pos){
        clearMarkers();
        
        if(pos != null){

            //WILL WORK IN SALESFORCE
            /*Visualforce.remoting.Manager.invokeAction(
              '{!$RemoteAction.ClosestCasesOnMapController.getCases}',
              pos, 
              function(results, event){
                  if (event.status) {
                     if(results.length){
                         for (var i = 0; i < results.length; i++) {
                              var markerLetter = String.fromCharCode('A'.charCodeAt(0) + i);
                              var markerIcon = MARKERS_PATH + markerLetter + '.png';
                              
                              // Use marker animation to drop the icons incrementally on the map.
                              markers[i] = new google.maps.Marker({
                                  position: results[i].location,
                                  animation: google.maps.Animation.DROP,
                                  icon: markerIcon
                              });
                              
                              // If the user clicks a marker, show the details of case
                              // in an info window.
                              markers[i].placeResult = results[i];
                              google.maps.event.addListener(markers[i], 'click', showInfoWindow);
                              setTimeout(dropMarker(markers[i]), i * 100);
                          }
                     }else{
                          showPopup("No cases nearby");
                     }
                  } else if (event.type === 'exception') {
                     showPopup("An error encountered!");
                  } else {
                      showPopup("An error encountered!");
                  }
              }, 
              {escape: true}
          );*/
          
          var results = [
                            {
                                "agentName": "AgentX",
                                "status": "Free",
                                "location": {
                                    "lat": 28.5244,
                                    "lng": 77.1855
                                }
                            },
                            {
                                "agentName": "AgentY",
                                "status": "Leaving for officeZ",
                                "location": {
                                    "lat": 28.5535,
                                    "lng": 77.2588
                                }
                            }
                        ];
          if(results.length){
               for (var i = 0; i < results.length; i++) {
                    var markerLetter = String.fromCharCode('A'.charCodeAt(0) + i);
                    var markerIcon = MARKERS_PATH + markerLetter + '.png';
                    
                    // Use marker animation to drop the icons incrementally on the map.
                    markers[i] = new google.maps.Marker({
                        position: results[i].location,
                        animation: google.maps.Animation.DROP,
                        icon: markerIcon
                    });
                    
                    // If the user clicks a marker, show the details of case
                    // in an info window.
                    markers[i].placeResult = results[i];
                    google.maps.event.addListener(markers[i], 'click', showInfoWindow);
                    setTimeout(dropMarker(markers[i]), i * 100);
                }
           }
        }
}

function showPopup(msg){
    document.getElementById("msg").innerHTML = msg;
    document.getElementById("popup").style.display = 'block';
    document.getElementById("container").style.opacity = 0.9;
    setTimeout(function(){
       hidePopup();
    }, 3000);
}

function hidePopup(){
    document.getElementById("container").style.opacity = 0
    document.getElementById("popup").style.display = 'none';
}

function showInfoWindow() {
  infoWindow.close();
  var clickedMarker = this;
  setInfoWindow(generateInfoWindowTemplate(clickedMarker.placeResult), clickedMarker);
}

function generateInfoWindowTemplate(result){
    var content  = '<div><center><strong>'+result.agentName+'</strong></center>';
        content += '<br/>';
        content += '<strong>Status : </strong>'+result.status;
        content += '<br/><br/>';
        content += '<center><a href="javascript:void(0)" id="info-link" onclick="navigateToId(\''+result.Id+'\')">View</a></center></div>';
    return content;
}

function setLocation(caseId, lat , lng){
    var pos = {lat : lat, lng: lng};
    showPopup('Location updated successfully');
    //WILL WORK IN SALESFORCE
    /*Visualforce.remoting.Manager.invokeAction(
          '{!$RemoteAction.ClosestCasesOnMapController.updateCaseWithLocation}',
          caseId,pos, 
          function(results, event){
              if (event.status) {
                  showPopup('Location updated successfully');
                  navigateToId(caseId);
              } else if (event.type === 'exception') {
                 showPopup("An error encountered!");
              } else {
                  showPopup("An error encountered!");
              }
          }, 
          {escape: true}
      );*/
    
}

function refreshCurrentTab(){
    sforce.console.getEnclosingTabId(function(result){
        var tabId = result.id;
        sforce.console.refreshPrimaryTabById(tabId, true, function(result){
            if(result.success == false){
                sforce.console.refreshSubtabById(tabId, true, function(result){
                    if(result.success == true){
                        console.log('Sub tab refreshed');    
                    }
                });
            }else{
                console.log('Primary tab refreshed');
            }
        });
    });
}

function navigateToId(recordId){

// WILL WORK IN SALESFORCE ORG
/*
    if(isSF1){
        sforce.one.navigateToSObject(recordId, 'detail');
    }else if(isInConsole){
        if(isCaseIdPresent('{!caseId}')){
            refreshCurrentTab();
        }else{
            sforce.console.openPrimaryTab(null,'/'+recordId, true);
        }
    }else if(isCommunity == 'true'){
        var url = window.parent.location.href;
        
        if(url.indexOf('/case/') > -1){
            url = url.replace(url.substring(url.lastIndexOf('/')+1), recordId);
        }else{
            url = url.substring(0, url.lastIndexOf('/')+1) + 'case/'+recordId;    
        }
        window.parent.location.href = url;
    }else{
        if(isCaseIdPresent('{!caseId}')){
            window.open('/'+recordId, '_parent');
        }else{
            window.open('/'+recordId);
        }
    }
*/
}

function dropMarker(marker) {
    marker.setMap(map);
}

function clearMarkers() {
  for (var i = 0; i < markers.length; i++) {
    if (markers[i]) {
      markers[i].setMap(null);
    }
  }
  markers = [];
}


function addCurrentLocationButton () {
    var controlDiv = document.createElement('div');

    var firstChild = document.createElement('button');
    firstChild.style.backgroundColor = '#fff';
    firstChild.style.border = 'none';
    firstChild.style.outline = 'none';
    firstChild.style.width = '28px';
    firstChild.style.height = '28px';
    firstChild.style.borderRadius = '2px';
    firstChild.style.boxShadow = '0 1px 4px rgba(0,0,0,0.3)';
    firstChild.style.cursor = 'pointer';
    firstChild.style.marginRight = '10px';
    firstChild.style.padding = '0';
    firstChild.title = 'Your Location';
    controlDiv.appendChild(firstChild);

    var secondChild = document.createElement('div');
    secondChild.setAttribute("id", "second-child");
    secondChild.style.margin = '5px';
    secondChild.style.width = '18px';
    secondChild.style.height = '18px';
    secondChild.style.backgroundImage = 'url(https://maps.gstatic.com/tactile/mylocation/mylocation-sprite-2x.png)';
    secondChild.style.backgroundSize = '180px 18px';
    secondChild.style.backgroundPosition = '0 0';
    secondChild.style.backgroundRepeat = 'no-repeat';
    firstChild.appendChild(secondChild);

    google.maps.event.addListener(map, 'center_changed', function () {
        secondChild.style['background-position'] = '0 0';
    });

    firstChild.addEventListener('click', function () {
        startCurrentButtonAnimation();
        getCurrentLocation();
        
    });

    controlDiv.index = 1;
    map.controls[google.maps.ControlPosition.RIGHT_BOTTOM].push(controlDiv);
}

var animationInterval;
function startCurrentButtonAnimation(){
    var imgX = '0';
    animationInterval = setInterval(function () {
        imgX = imgX === '-18' ? '0' : '-18';
        var secondChild = document.getElementById("second-child");
        secondChild.style['background-position'] = imgX+'px 0';
    }, 500);
}

function stopCurrentButtonAnimation(){
    clearInterval(animationInterval);
}

function initMap() {
  var pos = DEFAULT_POS;
  map = new google.maps.Map(document.getElementById('map'), {
      center : pos,
      zoom: DEFAULT_ZOOM
  });
  
  google.maps.event.addListenerOnce(map, 'idle', function(){
        var input = (document.getElementById('pac-input'));
        
        map.controls[google.maps.ControlPosition.TOP_CENTER].push(input);
        
        autocomplete = new google.maps.places.Autocomplete(input);
        autocomplete.bindTo('bounds', map);
        
        autocomplete.addListener('place_changed', placeChanged);
        addCurrentLocationButton();
        getCurrentLocation();
  });
  
  google.maps.event.addListener(map, "click", function(event) {
        var lat = event.latLng.lat();
        var lng = event.latLng.lng();
        // populate yor box/field with lat, lng
        geocodePosition(locationMarker, {lat:lat, lng:lng})
  });
}

function getParameterByName(name, url) {
    if (!url) url = window.location.href;
    name = name.replace(/[\[\]]/g, "\\$&");
    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, " "));
}