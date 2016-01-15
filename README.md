# loopback-connector-cloudant

## Usage

To use it you need to load the loopback-connector-juggler first if used programmatically, as any other connector.
Otherwise, set things up in your datasources.json (see Loopback.io documentation for details):

```   	
"YOURDATASOURCENAME":
{
	"connector": "cloudant"
	"username": "YOUR_CLOUDANT_USERNAME",
	"password": "YOUR_CLOUDANT_PASSWORD",
	"hostname": "YOUR_CLOUDANT_HOST",
	"database": "DBNAME",
	"port": 5948,
	"protocol": "https",
	"debug": false
}
```
    

## MIT License

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in
    all copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
    THE SOFTWARE.