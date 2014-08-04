(function($) {
    // Your custom JavaScript here:

    // JavaScript for image uploading and text editor (TODO: Modularize client-side JavaScript)
    var editor = null;

    $(document).ready(function() {
        $('#upload-form').ajaxForm({
            beforeSend: onUploadStart,
            uploadProgress: onUploadProgress,
            complete: onUploadCompleted
        });

        $('#upload-modal').on('show.bs.modal', function(event) {
            updateImages();
        });

        var textArea = document.getElementById("editor");
        if (textArea !== null) {
            editor = CodeMirror.fromTextArea(textArea, {
                mode: 'markdown',
                theme: 'monokai',
                indentUnit: 4
            });
        }

        $('code').each(function(elem) {
            var language = $('code').attr('class').split('-')[1],
                preElem = $('code').parent('pre');

            CodeMirror.colorize(preElem, language);
        });

        $('#upload-modal').on('show.bs.modal', function(event) {
            $('#upload-selected-image').removeAttr('src');
            $('#upload-insert-filename').val('');
            $('#upload-insert-alt-text').attr('disabled', 'disabled').val('');
            $('#upload-insert-title').attr('disabled', 'disabled').val('');
            $('#upload-insert-submit').attr('disabled', 'disabled');
        });

        $('#upload-modal-images').on('click', 'img', function(event) {
            var imageLink = $(this).attr('src'),
                filenameParts = imageLink.split('/'),
                filename = filenameParts[filenameParts.length - 1];

            $('#upload-selected-image').attr('src', imageLink);
            $('#upload-insert-filename').val(filename);
            $('#upload-insert-alt-text').removeAttr('disabled');
            $('#upload-insert-title').removeAttr('disabled');
            $('#upload-insert-submit').removeAttr('disabled');
        });

        $('#upload-insert-form').on('submit', function(event) {
            var markdown = '![' + $('#upload-insert-alt-text').val() + '](' +
                            $('#upload-selected-image').attr('src') + ' "' +
                            $('#upload-insert-title').val() + '")\n';
            console.log(markdown);

            editor.replaceSelection(markdown);

            $('#upload-modal').modal('hide');

            return false; // Prevent normal form submission
        });
    });

    function updateImages() {
        $.ajax('/api/images', {
                dataType: 'json',
                error: function(jqXHR, textStatus, errorThrown) {
                    console.log('Failed to load images: ', textStatus, ' - ', errorThrown);
                    $('div#upload-modal-images').html('<div class="alert alert-warning" role="alert">Error while loading images...</div>');
                },
                success: function(data, textStatus, jqXHR) {
                    if (data.images.length === 0) {
                        $('div#upload-modal-images').html('<div class="alert alert-info" role="alert">No images available - upload some...</div>');
                    } else {
                        var output = '';

                        for (var i = 0; i < data.images.length; i++) {
                            if (i % 4 === 0) {
                                if (i !== 0) {
                                    output += '</div>';
                                }

                                output += '<div class="row" />';
                            }

                            output += '<div class="col-md-3">';
                            output += '<a href="#" class="thumbnail">';
                            output += '<img src="' + data.images[i] + '">';
                            output += '</a>';
                            output += '</div>';
                        }

                        output += '</div>';

                        $('div#upload-modal-images').html(output);
                    }
                }
            });
    }

    function onUploadStart() {
        var progress = $('#upload-progress'),
            progressBar = progress.find('div.progress-bar'),
            form = $('#upload-form');
        
        progressBar.css('width', '0%');
        progress.show();
    }

    function onUploadProgress(event, position, total, percentComplete) {
        $('#upload-progress div.progress-bar').css('width', percentComplete + '%');
    }

    function onUploadCompleted(response) {
        var progress = $('#upload-progress'),
            progressBar = progress.find('div.progress-bar'),
            form = $('#upload-form');
        
        updateImages();

        setTimeout(function() { // Initial animations may not have finished yet if the uploaded file was small
            progress.hide(function() {
                form.clearForm();
            });
        }, 1000);
    }
}(jQuery));