import os
from google import genai
from google.genai import types

def main():
    try:
        project = os.environ.get("GOOGLE_CLOUD_PROJECT", "evento-489310")
        location = os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1")
        print(f"Project: {project}, Location: {location}")
        client = genai.Client(vertexai=True, project=project, location=location)
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents='Generate an image of a red cat',
            config=types.GenerateContentConfig(
                response_modalities=["IMAGE"]
            )
        )
        print("Got response")
        print(f"Parts count: {len(response.candidates[0].content.parts)}")
        for i, part in enumerate(response.candidates[0].content.parts):
            print(f"Part {i}:")
            print(f"  text: {bool(part.text)}")
            print(f"  inline_data: {bool(part.inline_data)}")
            if part.inline_data:
                print(f"    mime_type: {part.inline_data.mime_type}")
                print(f"    has data: {bool(part.inline_data.data)}")
            print(f"  executable_code: {bool(part.executable_code)}")
            print(f"  function_call: {bool(part.function_call)}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == '__main__':
    main()
