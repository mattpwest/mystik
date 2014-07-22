(function($) {
    // Your custom JavaScript here:

    // JavaScript for image uploading (TODO: Modularize client-side JavaScript)
    $(document).ready(function() {
        $('#upload-form').ajaxForm({
            beforeSend: onUploadStart,
            uploadProgress: onUploadProgress,
            complete: onUploadCompleted
        });
    });

    function onUploadStart() {
        var progress = $('#upload-progress'),
            progressBar = progress.find('div.progress-bar'),
            form = $('#upload-form');
        
        progressBar.css('width', '0%');
        form.hide(function() {
            progress.show();
        });
    }

    function onUploadProgress(event, position, total, percentComplete) {
        $('#upload-progress div.progress-bar').css('width', percentComplete + '%');
    }

    function onUploadCompleted(response) {
        var progress = $('#upload-progress'),
            progressBar = progress.find('div.progress-bar'),
            form = $('#upload-form');
        
        setTimeout(function() { // Initial animations may not have finished yet if the uploaded file was small
            progress.hide(function() {
                form.clearForm();
                form.show();
            });
        }, 1000);
    }
}(jQuery));