define([
'async!http://maps.google.com/maps/api/js?sensor=false',
'views/BaseView',
'text!templates/BoatDayTemplate.html',
'models/BoatModel'
], function(gmaps, BaseView, BoatDayTemplate, BoatModel){
	var BoatDayView = BaseView.extend({

		className:"view-event",

		template: _.template(BoatDayTemplate),

		debug: true,

		events: {
			
			"submit form" : "save",
			'change [name="boat"]' : "boatSelected", 
			'change [name="activity"]' : "refreshActivity", 
			'change [name="featuresFishingEquipment"]': "showFishingEquipment", 
			'change [name="featuresSportsEquipment"]': "showSportsEquipment",
			'blur [name="description"]': 'censorField'
		}, 

		_map: null,

		_marker: null,

		collectionBoats: {},

		collectionCaptains: {},
		
		theme: "dashboard",

		render: function() {

			BaseView.prototype.render.call(this);

			var self = this;

			//self.$el.find('.navbar-brand').text('Add a new boatday');

			var boatsFetchSuccess = function(matches) {

				var select = $('<select>').attr({ id: 'boat', name: 'boat', class: 'form-control' });

				_.each(matches, function(boat) {
					var opt = $('<option>').attr('value', boat.id).text(boat.get('name') + ', ' + boat.get('type'));
					select.append(opt);
					self.collectionBoats[boat.id] = boat;
				});
				
				self.$el.find('.boats').html(select);
				select.change()

			};

			var queryBoats = Parse.User.current().get('host').relation('boats').query();
			queryBoats.ascending('name');
			queryBoats.find().then(boatsFetchSuccess);

			this.$el.find('.date').datepicker({
				startDate: '0d',
				autoclose: true
			});

			if( this.model.get('date') ) {

				this.$el.find('.date').datepicker('setDate', this.model.get('date'));

			}

			var slidersConfig = { 
				tooltip: 'hide'
			};

			var updateTotalCalculator = function() {
				// ToDo take value from parse config
				var pricePerSeat = self._in('price').slider('getValue');
				var totalSeats = self._in('availableSeats').slider('getValue');
				var totalPriceUSD = pricePerSeat * totalSeats;
				var totalBoatDayUSD = 0.15 * totalPriceUSD;
				var totalHostUSD = totalPriceUSD - totalBoatDayUSD;
				self.$el.find('.totalSeats').text(totalSeats + " seats x $" + pricePerSeat);
				self.$el.find('.totalPriceUSD').text('$' + totalPriceUSD);
				self.$el.find('.totalBoatDayUSD').text('$' + totalBoatDayUSD);
				self.$el.find('.totalHostUSD').text('$' + totalHostUSD);	
			};

			var availableSeatsSlideEvent = function(slideEvt) {
				self.$el.find('.preview-availableSeats').text(slideEvt.value  + ' available seats');
				updateTotalCalculator();
			};

			var durationSlideEvent = function(slideEvt) {
				self.$el.find('.preview-duration').text(slideEvt.value + ' hour' + (slideEvt.value != 1 ? 's' : ''));
			};

			var priceSlideEvent = function(slideEvt) {
				self.$el.find('.preview-price').text('$'+slideEvt.value);
				updateTotalCalculator();
			};

			var departureTimeSlideEvent = function(slideEvt) {
				var maxDuration = Math.min(12, 24 - slideEvt.value);
				var duration = self._in('duration').slider('getValue');
				self._in('duration').slider({max: maxDuration}).slider('setValue', duration > maxDuration ? maxDuration : duration, true, false);
				self.$el.find('.preview-departureTime').text(self.departureTimeToDisplayTime(slideEvt.value));
			};

			this._in('availableSeats').slider(slidersConfig).on("slide", availableSeatsSlideEvent);
			this._in('departureTime').slider(slidersConfig).on("slide", departureTimeSlideEvent);
			this._in('duration').slider(slidersConfig).on("slide", durationSlideEvent);
			this._in('price').slider(slidersConfig).on("slide", priceSlideEvent);
			this._in('availableSeats').slider('setValue', this._in('availableSeats').slider('getValue'), true, false);
			this._in('departureTime').slider('setValue', this._in('departureTime').slider('getValue'), true, false);
			this._in('duration').slider('setValue', this._in('duration').slider('getValue'), true, false);
			this._in('price').slider('setValue', this._in('price').slider('getValue'), true, false);

			this.refreshActivity();

			this.setupGoogleMap();

			return this;

		},

		setupGoogleMap: function() {

			var self = this;

			var displayMap = function(latlng) {

				var opts = {
					zoom: 10,
					center: latlng
				};

				if( !self._map ) {
					
					var ctn = self.$el.find('.map').get(0);
					self._map = new google.maps.Map(ctn, opts);

					google.maps.event.addListener(self._map, 'click', function(event) {

						self.moveMarker(event.latLng)

					});

				}

				if( self.model.get('location') ) {

					self.moveMarker(new google.maps.LatLng(self.model.get('location').latitude, self.model.get('location').longitude));

				}

			};

			var handlePosition = function(position) {

    			displayMap(new google.maps.LatLng(position.coords.latitude, position.coords.longitude));

			};

			var handleNoPosition = function(error) {

				displayMap(new google.maps.LatLng(25.761919, -80.190225));

			};

			if (navigator.geolocation) {

				navigator.geolocation.getCurrentPosition(handlePosition, handleNoPosition);

			} else {

				handleNoPosition();

			}

		},

		moveMarker: function(latlng) {

			var self = this;

			var gotAddress = function (results, status) {

				if (status === google.maps.GeocoderStatus.OK) {

					if (results[0]) {
						
						self._in('location').val(results[0].formatted_address);
					
					}

				}

			};

			self._map.panTo(latlng);

			new google.maps.Geocoder().geocode({ 'latLng': latlng }, gotAddress);

			if( !self._marker ) {
					
				self._marker = new google.maps.Marker({
					map: self._map,
					draggable: true,
					animation: google.maps.Animation.DROP,
					position: latlng
				});

			} else {

				self._marker.setPosition(latlng);

			}

		},

		boatSelected: function(event) {

			var self = this;
			var boat = self.collectionBoats[$(event.currentTarget).val()];

			// Update max capacity
			var _max = Math.min(15, boat.get('capacity'));
			var _current = self._in('availableSeats').slider('getValue');
			self._in('availableSeats').slider({max: _max}).slider('setValue', _current > _max ? _max : _current, true, false);

			// Get captains
			self.collectionCaptains = {};
			self.collectionCaptains[Parse.User.current().get('profile').id] = Parse.User.current().get('profile');

			var queryCaptains = boat.relation('captains').query();
			queryCaptains.equalTo('status', 'approved');
			queryCaptains.include('captainProfile');
			queryCaptains.each(function(captainRequest) {

				self.collectionCaptains[captainRequest.get('captainProfile').id] = captainRequest.get('captainProfile')

			}).then(function() {

				var select = $('<select>').attr({ id: 'captain', name: 'captain', class: 'form-control' });

				_.each(self.collectionCaptains, function(captain) {
					var opt = $('<option>').attr('value', captain.id).text(captain.get('displayName'));
					select.append(opt);
					self.collectionCaptains[captain.id] = captain;
				});
				
				self.$el.find('.captains').html(select);
				select.change();
			});

		},

		refreshActivity: function() {

			var activity = this._in('activity').val();
			this.$el.find('.activityContainer').hide();
			this.$el.find(".activityContainer." + activity).show();
		
		},

		showFishingEquipment: function() {

			this.$el.find('.activityContainer.fishing .equipment-list').toggle();

		},

		showSportsEquipment:function() {

			this.$el.find('.activityContainer.sports .equipment-list').toggle();

		},

		save: function(event) {

			event.preventDefault();

			var self = this;
			var baseStatus = this.model.get('status');
			self.cleanForm();
			self.buttonLoader('Creating');

			var data = {
				status: 'complete',
				boat: self.collectionBoats ? self.collectionBoats[this._in('boat').val()] : null,
				captain: self.collectionCaptains ? self.collectionCaptains[this._in('captain').val()] : null,
				name: this._in('name').val(),
				description: this._in('description').val(),
				date: this._in('date').datepicker('getDate'),
				departureTime: this._in('departureTime').slider('getValue'),
				arrivalTime: this._in('departureTime').slider('getValue') + self._in('duration').slider('getValue'),
				duration: self._in('duration').slider('getValue'),
				location: self._marker ? new Parse.GeoPoint({latitude: self._marker.getPosition().lat(), longitude: self._marker.getPosition().lng()}) : null,
				availableSeats: self._in('availableSeats').slider('getValue'),
				price: self._in('price').slider('getValue'), 
				bookingPolicy: this.$el.find('[name="bookingPolicy"]:checked').val(),
				cancellationPolicy: this.$el.find('[name="cancellationPolicy"]:checked').val(), 
				category: this._in('activity').val(),
				features: {
					leisure: {
						cruising: Boolean(this.$el.find('[name="featuresLeisureCruising"]').is(':checked')),
						partying: Boolean(this.$el.find('[name="featuresLeisurePartying"]').is(':checked')),
						sightseeing: Boolean(this.$el.find('[name="featuresLeisureSightseeing"]').is(':checked')),
						other: Boolean(this.$el.find('[name="featuresLeisureOther"]').is(':checked'))
					},
					fishing: {
						flats: Boolean(this.$el.find('[name="featuresFishingFlats"]').is(':checked')),
						lake: Boolean(this.$el.find('[name="featuresFishingLake"]').is(':checked')),
						offshore: Boolean(this.$el.find('[name="featuresFishingOffshore"]').is(':checked')),
						recreational: Boolean(this.$el.find('[name="featuresFishingRecreational"]').is(':checked')),
						other: Boolean(this.$el.find('[name="featuresFishingOther"]').is(':checked')),
						equipment: Boolean(this.$el.find('[name="featuresFishingEquipment"]').is(':checked')),
						equipmentItems: {
							bait: Boolean(this.$el.find('[name="featuresFishingEquipmentItemsBait"]').is(':checked')),
							lines: Boolean(this.$el.find('[name="featuresFishingEquipmentItemsLines"]').is(':checked')),
							hooks: Boolean(this.$el.find('[name="featuresFishingEquipmentItemsHooks"]').is(':checked')),
							lures: Boolean(this.$el.find('[name="featuresFishingEquipmentItemsLures"]').is(':checked')),
							nets: Boolean(this.$el.find('[name="featuresFishingEquipmentItemsNets"]').is(':checked')),
							rods: Boolean(this.$el.find('[name="featuresFishingEquipmentItemsRods"]').is(':checked')),
							sinkers: Boolean(this.$el.find('[name="featuresFishingEquipmentItemsSinkers"]').is(':checked'))
						}
					},
					sports: {
						snorkeling: Boolean(this.$el.find('[name="featuresSportsSnorkeling"]').is(':checked')),
						tubing: Boolean(this.$el.find('[name="featuresSportStubing"]').is(':checked')),
						wakeBoarding: Boolean(this.$el.find('[name="featuresSportsWakeBoarding"]').is(':checked')),
						waterSkiing: Boolean(this.$el.find('[name="featuresSportsWaterSkiing"]').is(':checked')),
						equipment: Boolean(this.$el.find('[name="featuresSportsEquipment"]').is(':checked')),
						equipmentItems: {
							fins: Boolean(this.$el.find('[name="featuresSportsEquipmentItemsFins"]').is(':checked')),
							helmets: Boolean(this.$el.find('[name="featuresSportsEquipmentItemsHelmets"]').is(':checked')),
							masks: Boolean(this.$el.find('[name="featuresSportsEquipmentItemsMasks"]').is(':checked')),
							snorkels: Boolean(this.$el.find('[name="featuresSportsEquipmentItemsSnorkels"]').is(':checked')),
							towLine: Boolean(this.$el.find('[name="featuresSportsEquipmentItemsTowLine"]').is(':checked')),
							tubes: Boolean(this.$el.find('[name="featuresSportsEquipmentItemsTubes"]').is(':checked')),
							wakeboard: Boolean(this.$el.find('[name="featuresSportsEquipmentItemsWakeboard"]').is(':checked')),
							waterSkis: Boolean(this.$el.find('[name="featuresSportsEquipmentItemsWaterSkis"]').is(':checked'))
						}
					},
					global: {
						children: Boolean(this.$el.find('[name="featuresGlobalChildren"]').is(':checked')),
						smoking: Boolean(this.$el.find('[name="featuresGlobalSmoking"]').is(':checked')),
						drinking: Boolean(this.$el.find('[name="featuresGlobalDrinking"]').is(':checked')),
						pets: Boolean(this.$el.find('[name="featuresGlobalPets"]').is(':checked')) 
					}, 
					extras: {
						food: Boolean(this.$el.find('[name="featuresExtrasFood"]').is(':checked')),
						drink: Boolean(this.$el.find('[name="featuresExtrasDrink"]').is(':checked')),
						music: Boolean(this.$el.find('[name="featuresExtrasMusic"]').is(':checked')),
						towels: Boolean(this.$el.find('[name="featuresExtrasTowels"]').is(':checked')),
						sunscreen: Boolean(this.$el.find('[name="featuresExtrasSunscreen"]').is(':checked')),
						inflatables: Boolean(this.$el.find('[name="featuresExtrasInflatables"]').is(':checked'))
					}
				}
			};

			var saveSuccess = function( boatday ) {
		
				if( baseStatus == 'creation' ) {

					var hostSaveSuccess = function() {
						Parse.history.navigate('boatday/'+boatday.id, true);
					};

					var hostSaveError = function(error) {
						console.log(error);
					}

					var host = Parse.User.current().get("host");
					host.relation('boatdays').add(boatday);
					host.save().then(hostSaveSuccess, hostSaveError);

				} else {
					
					Parse.history.navigate('dashboard', true);

				}

			};

			var saveError = function(error) {
				
				self.buttonLoader();

				if( error.type && error.type == 'model-validation' ) {
					console.log(error);
					_.map(error.fields, function(message, field) { 
						self.fieldError(field, message);
					});

				} else {

					console.log(error);
					self._error(error);

				}

			};

			self.model.save(data).then(saveSuccess, saveError);

		}
	});
	return BoatDayView;

});