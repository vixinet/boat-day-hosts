define([
'views/BaseView',
'models/ProfileModel',
'text!templates/HostTemplate.html'
], function(BaseView, ProfileModel, HostTemplate){
	var HostView = BaseView.extend({

		className: "view-host-registration",

		template: _.template(HostTemplate),

		debug: true,


		events: {
			"submit form" : "registerHost", 
			'change [name="paymentMethod"]' : "refreshPaymentMethod",
			"change .upload": "uploadCertification",
		},

		initialize: function(){
			this.profilePicture = this.model.get('profilePicture');

			this.tempBinaries.certBSC = this.model.get('certBSC');
			this.tempBinaries.certCCL = this.model.get('certCCL');
			this.tempBinaries.certMCL = this.model.get('certMCL');
			this.tempBinaries.certFL = this.model.get('certFL');
			this.tempBinaries.certSL = this.model.get('certSL');
			this.tempBinaries.certFAC = this.model.get('certFAC');
		},

		uploadCertification: function(event) {

			var cb = function(file) {
				
				var parent = $(event.currentTarget).closest('div');
				var preview = parent.find('.preview');

				if( preview.length == 1 ) {
					preview.attr('href', file.url());
				} else {
					var link = $('<a>').attr({ 'href': file.url(), target: '_blank' }).text('Licence preview').addClass('preview');
					parent.append(link);	
				}

			}

			this.uploadFile(event, cb);
		},

		render: function() {

			BaseView.prototype.render.call(this);
			
			var birthdateYear = this.model.get('birthdate') ? this.model.get('birthdate').getFullYear() : 1993;

			for(var i = 1940; i < new Date().getFullYear() - 21; i++) {
				
				var opt = $('<option>').val(i).text(i);
				
				if( birthdateYear == i ) {
					opt.attr('selected', 1);
				}

				this.$el.find('[name="birthdateYear"]').append(opt);
			}

			this.refreshPaymentMethod();
			
			return this;
		},

		debugAutofillFields: function() {
			
			if( this.model.get('status') == 'creation' ) {

				this._in('firstname').val('Daniel');
				this._in('lastname').val('Costa');
				this._in('SSN').val('9861');

				this._in('businessName').val('Peer-to-Pier Technologies LLC');
				this._in('businessEin').val('46-4074689');
				this._in('businessContact').val('Daniel Costa');

				this._in('phone').val('123-123-1234');
				this._in('street').val('9861 SW 117th Ct');
				this._in('city').val('Miami');
				this._in('zipCode').val('98613');

				this._in('accountHolder').val('Daniel Costa');
				this._in('accountNumber').val('1039531801');
				this._in('accountRouting').val('324377516');
				this._in('paypalEmail').val('paypal@boatdayapp.com');
				this._in('venmoEmail').val('venmo@boatdayapp.com');
				this._in('venmoPhone').val('912-123-1234');

				this._in('state').find('option[value="FL"]').attr('selected', 1);
			
			}
		},

		refreshPaymentMethod: function() {

			var paymentMethod = this._in('paymentMethod').val();
			this.$el.find('.paymentMethodContainer').hide();
			this.$el.find(".paymentMethodContainer." + paymentMethod).show();

		},

		registerHost: function(event) {

			event.preventDefault();

			var self = this;

			self.buttonLoader('Saving');
			self.cleanForm();

			var baseStatus = this.model.get('status');

			var data = {
				status: "complete",
				phone: this._in('phone').val(),
				street: this._in('street').val(),
				city: this._in('city').val(),
				zipCode: this._in('zipCode').val(),
				state: this._in('state').val(), 
				paymentMethod: this._in('paymentMethod').val(), 
				accountHolder: this._in('accountHolder').val(),
				accountNumber: this._in('accountNumber').val(),
				accountRouting: this._in('accountRouting').val(),
				paypalEmail: this._in('paypalEmail').val(),
				venmoEmail: this._in('venmoEmail').val(),
				venmoPhone: this._in('venmoPhone').val(),
				firstname: this._in('firstname').val(),
				lastname: this._in('lastname').val(),
				birthdate: new Date(this._in('birthdateYear').val(), this._in('birthdateMonth').val()-1, this._in('birthdateDay').val()),
				SSN: this._in('SSN').val(),
				businessName: this._in('businessName').val(),
				businessEin: this._in('businessEin').val(),
				certBSC: self.tempBinaries.certBSC,
				certCCL: self.tempBinaries.certCCL,
				certMCL: self.tempBinaries.certMCL,
				certFL: self.tempBinaries.certFL,
				certSL: self.tempBinaries.certSL,
				certFAC: self.tempBinaries.certFAC
			};
			
			var hostRegistrationSuccess = function() {

				if( baseStatus == 'creation' ) {

					Parse.history.loadUrl(Parse.history.fragment);

				} else {

					Parse.history.navigate("dashboard", true);

				}

			};

			var saveError = function(error) {
				
				self.buttonLoader();

				if( error.type && error.type == 'model-validation' ) {

					_.map(error.fields, function(message, field) { 
						self.fieldError(field, message);
					});

				} else {

					console.log(error);
					self._error(error);

				}

			};

			this.model.save(data).then(hostRegistrationSuccess, saveError);
		}

	});
	return HostView;
});