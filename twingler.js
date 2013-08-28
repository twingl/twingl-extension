var twingler = {
  annotator: {},
  currentAnnotation: {}, // Not sure if we need to store the annotation here or not.
  currentTwinglings: [],
  $twingler: {}, // Maybe we store DOM elements as an array so we can systematically clear them upon "Done"
  init: function(annotator) {
    this.annotator = annotator; // Annotator object added to Twingler.
    this.annotator.wrapper.append("<div id='twingler'><button id='twingler-close'>Done</button><input type='search' id='twingler-search-field'><button id='twingler-search'>Search</button><ul class='twingl-search-results'></ul></div>");
    this.$twingler = $("#twingler");
    this.$searchfield = $("#twingler-search-field");
    var that = this;

    // Bind events
    $('#twingler-close').click(function() {
      twingler.done();
    });
    $('#twingler-search').click(function() {
      twingler.search(that.$searchfield.val());
    });

    console.log("Twingler has been initialised.", this);
  },
  begin: function(annotation) {
    this.$twingler.show();
    this.currentAnnotation = annotation;
    this.currentTwinglings = annotation.twinglings;
  },
  search: function(query) {
    // TODO: Hook up "Working" state. 

    $.ajax({
      url: 'http://api.twin.gl/flux/highlights/search',
      type: 'GET',
      data: {
        q: query
      },
      success: function(data) {
        twingler.parseResults(data);
      },
      error: function(data, status, error) {
        console.log(data, status, error);
      }
    });
  },
  parseResults: function(results) {
    // Exclude current twinglings, current annotation from results.
    var currentAnnotation = this.currentAnnotation;
    var currentTwinglings = this.currentTwinglings;
    var newResults = [];

    for (var i = results.length - 1; i >= 0; i--) {
      var isTwinglable = true;

      if (results[i].result_id == currentAnnotation.id) {
        // IS NOT TWINGLABLE
        isTwinglable = false;
      } else if (currentTwinglings.length > 0) {
        for (var j = currentTwinglings.length - 1; j >= 0; j--) {
          if (currentTwinglings[j].end_id == results[i].result_id || currentTwinglings[j].start_id == results[i].result_id) {
            // IS A TWINGLING
            isTwinglable = false;
          }
        }
      };

      if (isTwinglable == true) {
        newResults.push(results[i]);
      }
    };

    this.renderResults(newResults);
  },
  renderResults: function(results) {
    // TODO : Return "No Results" if empty.

    $searchresults = $("#twingler .twingl-search-results");
    $searchresults.empty();
    
    for (var i = results.length - 1; i >= 0; i--) {
      result = results[i].result_object;
      $searchresults.append("<li class='twingl-returned-result' data-id="+result.id+">" + result.quote + "</li>");
    };
    
    $('.twingl-returned-result').off('click').on('click', this.currentAnnotation, twinglerCrud.create);
  },
  done: function() {
    this.$twingler.hide();
    this.currentTwinglings = []; 
    // TODO: Unset all values, like search results. 
  },
  unload: function() {
    this.$twingler.remove();
    this.$twingler = {};
  }
}

var twinglerCrud = {
  create: function(event) { 
    var $elem = $(this);
    var annotation = event.data;
    var dest_id = $(this).attr("data-id");
    var src_id = annotation.id;
    
    twinglerCrud.working.start($elem);

    $.ajax({
      url: "http://api.twin.gl/flux/twinglings",
      type: "POST",
      data: {
        start_type: "highlights",
        start_id: src_id,
        end_type: "highlights",
        end_id: dest_id
      },
      success: function(data) {
        console.log("Great success! Twingling is create.", data);
        twinglerCrud.working.success($elem);
        $.ajax({ 
          // Get the freshly created Twingling and and attach it to the Annotation object.
          url: "http://api.twin.gl/flux/twinglings/" + data.id + "?expand=end_object",
          type: "GET",
          success: function(data) {
            twingler.annotator.publish("twinglingCreated", [data, annotation]);
          }
        });
      },
      error: function(data, status, error) {
        console.log(data, status, error);
        twinglerCrud.working.error($elem, error);
      }
    })
  },
  destroy: function(event) {
    var $elem = $(this).parent();
    var twingling_id = $elem.attr("data-id");
    var annotation = event.data;

    twinglerCrud.working.start($elem);

    $.ajax({
      url: "http://api.twin.gl/flux/twinglings/" + twingling_id,
      type: "DELETE",
      success: function(data) {
        twingler.annotator.publish("twinglingDestroyed", [twingling_id, annotation]);
        twinglerCrud.working.success($elem);
      },
      error: function(data, status, error) {
        console.log(data, status, error);
        twinglerCrud.working.error($elem, error);
      }
    });
  },
  working: {
    start: function(elem) {
      elem.off('click').addClass('working');
    },
    success: function(elem) {
      elem.remove();
    },
    error: function(elem) {
      // If there was an error, we need to bind an event to "Try Submitting Again". 
      // We also need to set an error class.
      // We also need the ability to "Report Bug"
    }
  }
}