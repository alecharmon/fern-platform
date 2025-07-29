Understand when EdgeWorker scripts are executed. The EdgeWorkers code is invoked based on specific HTTP events. To create a function for any of these events, implement the callbacks as explained in the [JavaScript API reference](about-the-javascript-api.md).

<Frame>
  <img src="https://techdocs.akamai.com/edgeworkers/img/eventModel-v1.jpg" alt="event handlers" />
</Frame>

The responseProvider event handler acts as a surrogate origin to execute EdgeWorkers code. To learn more, go to the [Response Orchestration](response-orchestration.md) section.

<Frame>
  <img src="https://techdocs.akamai.com/edgeworkers/img/responseProviderEvent-v1.jpg" alt="responseProvider event handler" />
</Frame>

## onClientRequest

The `onClientRequest` event happens for every request as the request is received, before checking if a response is available in cache. Use this event for request modifications before going to cache or to origin. Here's an example of a function that modifies the response based on user location:

```javascript
// redirect based on originating country of request
 
export function onClientRequest(request) {
   var country = request.userLocation.country;
    if (country === 'FR') {
       request.respondWith(302, {'Location': ['https://www.example.com/fr/']}, '');
    }
}
```

Review the table for information about the available parameters.

| Parameter | Type                          | Description                                                                                                               |
| :-------- | :---------------------------- | :------------------------------------------------------------------------------------------------------------------------ |
| request   | [Request ](request-object.md) | An object representing the current request. Modifications to this request object are visible in all other event handlers. |

## onOriginRequest

The `onOriginRequest` event happens just before sending the request to the origin. This event only happens if the response is not served from cache and not constructed on the edge. Use this event if you want to affect the response coming back from the origin. Changes to the [Request Object](request-object.md) made during `onOriginRequest` update the outgoing request to the origin. The changes are not visible in later event handlers.

This function adds a device type header to the origin request:

```javascript
// send header to origin
 
export function onOriginRequest(request) {
   if (request.device.isMobile) { 
      request.setHeader('X-MyHeader-DeviceType','Mobile'); 
   } 
   else if (request.device.isTablet) { 
      request.setHeader('X-MyHeader-DeviceType', 'Tablet'); 
   } 
   else { 
      request.setHeader('X-MyHeader-DeviceType', 'Desktop'); 
   }
}
```

Review the table for information about the available parameters.

| Parameter | Type                         | Description                                                                                                                                                             |
| :-------- | :--------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| request   | [Request](request-object.md) | An object representing the outgoing current request. Modifications to this request object are visible to the origin but not visible to any of the other event handlers. |

## onOriginResponse

The `onOriginResponse` event happens as the origin response is created. The event only happens if the response is not served from cache and not constructed on the edge. Use this event if you want to modify the response before it is cached.

```javascript
// remove header returned from origin
 
export function onOriginResponse(request, response) {
response.removeHeader('InternalDebugHeader');
}
```

Review the table for information about the available parameters.

| Parameter | Type                           | Description                                                                                                                                |
| :-------- | :----------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------- |
| request   | [Request](request-object.md)   | An object representing the current request after modifications by the `onClientRequest` event handler.                                     |
| response  | [Response](response-object.md) | An object representing the current response. Modifications to the Response object are only visible in the `onClientRequest` event handler. |

## onClientResponse

The `onClientResponse` happens before the response is sent to the client.

This example shows how to set a header before the response is sent to the client:

```javascript
// add response header
 
export function onClientResponse(request, response) {
response.addHeader('Powered-By','Akamai EdgeWorkers');
}
```

Review the table for information about the available parameters.

| Parameter | Type                           | Description                                                                                             |
| :-------- | :----------------------------- | :------------------------------------------------------------------------------------------------------ |
| request   | [Request](request-object.md)   | An object representing the current request, after modifications by the `onClientRequest` event handler. |
| response  | [Response](response-object.md) | An object representing the current response.                                                            |

## responseProvider

The `responseProvider` event happens if the response is not already found in cache. This example shows how to return a response body:

```javascript
//add content to the response

export function responseProvider(request) {
return Promise.resolve(createResponse(200, {}, "<html><head></head><body><p>Hello World</p></body></html>"));
}
```

> 📘 To find more information about how EdgeWorker scripts are executed during the `responseProvider` event see [Response Orchestration](response-orchestration.md).

Review the table for information about the available parameters.

| Parameter | Type                         | Description                                                                                                                            |
| :-------- | :--------------------------- | :------------------------------------------------------------------------------------------------------------------------------------- |
| request   | [Request](request-object.md) | An object representing the incoming request. Modifications to this request object are visible in the `onClientResponse` event handler. |

##

# Event handler methods

View the supported HTTP methods for the EdgeWorkers event handlers.

| Event handler                                                                                                    | Supported methods                                                                     | Unsupported methods |
| ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------- |
| `onOriginRequest`<br />`onOriginResponse`<br />`onClientResponse`<br />`onClientRequest`<br />`responseProvider` | GET<br />HEAD<br />POST<br />PUT<br />PATCH<br />DELETE<br />OPTIONS (see note below) | CONNECT<br />TRACE  |

> 📘 To use the OPTIONS HTTP method you need to add the `PMUSER_EW_ENABLE_OPTIONS` [variable](https://techdocs.akamai.com/property-mgr/docs/user-defined-vars)  to your rule and set the value to `true`. The name of the variable must be UPPERCASE.

> 👍 [Sub-requests](http-request.md#httprequest)  support the `GET`, `HEAD`, `POST`, `PUT`, and `DELETE` methods.

# Bypass event handlers

To prevent specific event handlers from executing you can [create a Property Manager variable](https://techdocs.akamai.com/property-mgr/docs/var-ov).

Refer to this table for the PMUSER\_BYPASS variable name to use for each event handler and to see the metadata stage when it's evaluated.

| Event handler      | Variable name               | Metadata stage evaluation |
| :----------------- | :-------------------------- | :------------------------ |
| `onClientRequest`  | BYPASS\_EW\_CLTREQ\_EVENT   | `client-request`          |
| `onOriginRequest`  | BYPASS\_EW\_ORGNREQ\_EVENT  | `forward-request`         |
| `onOriginResponse` | BYPASS\_EW\_ORGNRESP\_EVENT | `forward-response`        |
| `onClientResponse` | BYPASS\_EW\_CLTRESP\_EVENT  | `client-response`         |
| `responseProvider` | BYPASS\_EW\_RP\_EVENT       | `client-request`          |

To bypass an event, set the **initial value** of the corresponding variable to "true".

> 👍 The PMUSER\_ prefix for the variable is automatically included.

<Frame>
  <img src="https://techdocs.akamai.com/edgeworkers/img/edgeworkers-bypassvariable-v1.png" alt="EdgeWorkers bypass variable" />
</Frame>

EdgeWorkers event handlers are always bypassed if their respective PMUSER variables are set, no matter which metadata stage they are restricted to. You can use use BYPASS variables in a programmatic manner to:

* Make decisions in later metadata stages when access to more information is available. For example, you can only execute `onClientResponse` if a specific response header is present.
* Set the variables from within an EdgeWorkers event, to bypass later events.
