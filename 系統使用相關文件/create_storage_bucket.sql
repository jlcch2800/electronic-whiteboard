-- Enable the storage extension if not already enabled (usually enabled by default)
-- CREATE EXTENSION IF NOT EXISTS "storage";

-- 1. Create the 'work-files' bucket
insert into storage.buckets (id, name, public)
values ('work-files', 'work-files', true)
on conflict (id) do nothing;

-- 2. Set up RLS policies for the bucket
-- Allow authenticated users to upload files
create policy "Authenticated users can upload files"
on storage.objects for insert
to authenticated
with check ( bucket_id = 'work-files' );

-- Allow public access to view files (since it's a public bucket)
create policy "Public Access"
on storage.objects for select
to public
using ( bucket_id = 'work-files' );

-- Allow authenticated users to delete files (optional, but good for management)
create policy "Authenticated users can delete files"
on storage.objects for delete
to authenticated
using ( bucket_id = 'work-files' );
