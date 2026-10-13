-- Uploads up to 10MB. Files bigger than the host's request limit go straight from the
-- browser to the person's own `incoming/` folder in this private bucket through a one
-- time signed URL; the server reads each one once and deletes it.
update storage.buckets
   set file_size_limit = 10485760,
       allowed_mime_types = array[
         'image/jpeg', 'image/png', 'image/webp',
         'application/pdf',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
         'application/msword',
         'text/plain'
       ]
 where id = 'job-uploads';
